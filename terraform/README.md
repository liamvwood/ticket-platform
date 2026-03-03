# Terraform — Ticket Platform Infrastructure

Defines all AWS infrastructure for Austin Tickets as Terraform code. One command (`terraform apply`) stands up a complete, production-ready environment.

## What gets created

| Resource | Description |
|----------|-------------|
| **VPC** | `/16` CIDR with 3 public + 3 private subnets across AZs, NAT gateway(s), IGW |
| **EKS cluster** | Kubernetes 1.31, managed node group, OIDC provider for IRSA |
| **ECR repositories** | `ticket-platform-api` + `ticket-platform-frontend`, scan-on-push, lifecycle policy |
| **RDS PostgreSQL 16** | In private subnet, encrypted, automated backups, security group locked to EKS nodes |
| **S3 bucket** | Event thumbnails — public-read via bucket policy, CORS enabled |
| **IAM** | CI/CD user (ECR push + EKS deploy), IRSA role for API pods (S3 + SSM), EBS CSI driver role |
| **SSM parameters** | All application secrets (JWT, DB connection, Stripe, owner credentials) |
| **nginx ingress** | Helm-managed, NLB-backed, snippet annotations disabled |
| **cert-manager** | Let's Encrypt ClusterIssuer for automatic TLS |
| **kube-prometheus-stack** | Prometheus, Grafana (with sidecar dashboard loader), Alertmanager |
| **Kubernetes namespace + ServiceAccount** | App namespace + IRSA-annotated ServiceAccount for the API pod |

## Prerequisites

- Terraform ≥ 1.6
- AWS CLI configured with admin credentials (`aws sts get-caller-identity` should work)
- `kubectl` (optional — for post-deploy verification)

## Quick start

### 1. Bootstrap remote state (once per AWS account)

```bash
export AWS_REGION=us-east-1
bash terraform/scripts/bootstrap-state.sh
```

This creates an S3 bucket and DynamoDB table for Terraform state. Update `<ACCOUNT_ID>` in the backend files with the ID printed by the script.

### 2. Initialise for your environment

```bash
cd terraform

# Test ring
terraform init -backend-config=environments/test-backend.tfvars

# Production
terraform init -backend-config=environments/prod-backend.tfvars
```

### 3. Plan

```bash
# Test
terraform plan -var-file=environments/test.tfvars

# Production
terraform plan -var-file=environments/prod.tfvars
```

### 4. Apply

```bash
terraform apply -var-file=environments/test.tfvars
```

First apply takes ~15–20 minutes (EKS cluster creation dominates).

### 5. Configure GitHub Actions secrets

After apply, retrieve outputs and set them as repository secrets:

```bash
# Print all outputs
terraform output -json

# Retrieve sensitive values
terraform output -raw ci_access_key_id
terraform output -raw ci_secret_access_key
```

| GitHub Secret | Value |
|---------------|-------|
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | `terraform output -raw ci_access_key_id` |
| `AWS_SECRET_ACCESS_KEY` | `terraform output -raw ci_secret_access_key` |
| `ECR_REGISTRY` | `terraform output -raw ecr_registry` |
| `EKS_CLUSTER_NAME` | `terraform output -raw cluster_name` |
| `TEST_API_HOST` | your API domain |
| `TEST_FRONTEND_HOST` | your frontend domain |

### 6. Update secrets before going live (production)

The Stripe and owner-password parameters are initialised with placeholder values.
Update them via SSM before the first deployment:

```bash
aws ssm put-parameter \
  --name /ticket-platform/prod/stripe-secret-key \
  --value "sk_live_..." \
  --type SecureString \
  --overwrite

aws ssm put-parameter \
  --name /ticket-platform/prod/owner-password \
  --value "your-secure-password" \
  --type SecureString \
  --overwrite
```

## Environment differences

| Setting | test | prod |
|---------|------|------|
| Node type | t3.small | t3.medium |
| Node count | 1–3 | 2–20 |
| RDS class | db.t3.micro | db.t3.small |
| RDS storage | 20 GB | 100 GB |
| NAT gateways | 1 (single) | 3 (one per AZ) |
| RDS deletion protection | No | Yes |
| RDS final snapshot | No | Yes |
| Performance Insights | No | Yes |
| ECR image retention | 20 | 50 |
| CORS origin for thumbnails | `*` | `https://app.austintickets.dev` |

## Module versions

| Module | Version |
|--------|---------|
| `terraform-aws-modules/vpc/aws` | `~> 5.0` |
| `terraform-aws-modules/eks/aws` | `~> 20.0` |
| nginx ingress controller chart | `4.10.1` |
| cert-manager chart | `v1.14.4` |
| kube-prometheus-stack chart | `58.6.0` |

## Destroying an environment

```bash
# Test ring only — will NOT destroy if deletion_protection=true (prod)
terraform destroy -var-file=environments/test.tfvars
```

> **Warning**: `terraform destroy` on production is blocked by `deletion_protection = true`
> on the RDS instance. Manually disable it first if intentional.

## Directory structure

```
terraform/
├── main.tf              # Provider config, backend, data sources, locals
├── variables.tf         # All input variables with descriptions and defaults
├── outputs.tf           # Key outputs (cluster, ECR, RDS, S3, CI credentials)
├── vpc.tf               # VPC, subnets, NAT, IGW, route tables
├── eks.tf               # EKS cluster, managed node group, OIDC, EBS CSI role
├── ecr.tf               # ECR repositories and lifecycle policies
├── rds.tf               # RDS PostgreSQL, subnet group, security group
├── s3.tf                # Event thumbnails bucket, CORS, public-read policy
├── iam.tf               # CI/CD IAM user, IRSA role for API pod
├── ssm.tf               # Application secrets in SSM Parameter Store
├── k8s-addons.tf        # Helm: nginx ingress, cert-manager, Prometheus/Grafana
├── environments/
│   ├── test.tfvars          # Test ring variable overrides
│   ├── prod.tfvars          # Production variable overrides
│   ├── test-backend.tfvars  # S3 backend config for test state
│   └── prod-backend.tfvars  # S3 backend config for prod state
└── scripts/
    └── bootstrap-state.sh   # One-time S3 + DynamoDB state backend setup
```
