# Terraform — Ticket Platform Infrastructure

Defines all AWS infrastructure for Slingshot as Terraform code. One command (`terraform apply`) stands up a complete, production-ready environment.

## What gets created

| Resource | Description |
|----------|-------------|
| **VPC** | `/16` CIDR with 3 public + 3 private subnets across AZs, NAT gateway(s), IGW |
| **ECS Fargate cluster** | Serverless container cluster with Container Insights enabled |
| **ECS services** | API service (port 8080) and frontend service (port 80), both with CPU-based auto-scaling |
| **Application Load Balancer** | Public ALB with HTTP→HTTPS redirect, host-based routing to API and frontend |
| **ACM certificate** | TLS certificate for `api_domain` and `frontend_domain` with DNS validation |
| **ECR repositories** | `ticket-platform-api` + `ticket-platform-frontend`, scan-on-push, lifecycle policy |
| **RDS PostgreSQL 16** | In private subnet, encrypted, automated backups, security group locked to ECS tasks |
| **ElastiCache Redis** | Single-node Redis 7.1 for hotness tracking, security group locked to ECS tasks |
| **S3 bucket** | Event thumbnails — public-read via bucket policy, CORS enabled |
| **IAM** | CI/CD user (ECR push + ECS deploy), ECS task execution role (ECR + SSM), API task role (S3 + SSM) |
| **SSM parameters** | All application secrets (JWT, DB connection, Stripe, Redis, owner credentials) — injected into ECS tasks at start |
| **CloudWatch log groups** | `/ecs/{env}/api` and `/ecs/{env}/frontend`, 30-day retention |

## Prerequisites

- Terraform ≥ 1.6
- AWS CLI configured with admin credentials (`aws sts get-caller-identity` should work)

## Quick start

### 1. Bootstrap remote state (once per AWS account)

```bash
export AWS_REGION=us-east-1
bash terraform/scripts/bootstrap-state.sh
```

This creates an S3 bucket and DynamoDB table for Terraform state. Update `<ACCOUNT_ID>` in the backend files with the ID printed by the script.

### 2. Configure TLS (before first apply)

Choose one of:

**Option A — Automatic (Route 53 hosted zone)**  
Set `route53_zone_id` in your `.tfvars` file. Terraform creates the ACM certificate and adds the DNS validation CNAME records automatically.

**Option B — Existing certificate**  
Set `certificate_arn` to the ARN of an ACM certificate already in `ISSUED` state covering both `api_domain` and `frontend_domain`.

**Option C — Manual DNS validation (first-time only)**  
Leave both empty. After the first `terraform apply`, run:
```bash
terraform output acm_validation_records
```
Add the CNAME records to your DNS provider, wait for the certificate status to reach `ISSUED`, then run `terraform apply` again.

### 3. Initialise for your environment

```bash
cd terraform

# Test ring
terraform init -backend-config=environments/test-backend.tfvars

# Production
terraform init -backend-config=environments/prod-backend.tfvars
```

### 4. Plan & apply

```bash
# Test
terraform plan -var-file=environments/test.tfvars
terraform apply -var-file=environments/test.tfvars
```

First apply takes ~5–8 minutes (ALB and ECS cluster creation).

### 5. Configure DNS

After apply, point your `api_domain` and `frontend_domain` DNS records at the ALB:

```bash
terraform output alb_dns_name
```

Create a CNAME (or ALIAS if using Route 53) from each domain to that DNS name.

### 6. Configure GitHub Actions secrets

After apply, set these as repository secrets:

```bash
terraform output -json
terraform output -raw ci_access_key_id
terraform output -raw ci_secret_access_key
```

| GitHub Secret | Value |
|---------------|-------|
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | `terraform output -raw ci_access_key_id` |
| `AWS_SECRET_ACCESS_KEY` | `terraform output -raw ci_secret_access_key` |
| `ECR_REGISTRY` | `terraform output -raw ecr_registry` |
| `ECS_CLUSTER` | `terraform output -raw ecs_cluster_name` |
| `TEST_API_HOST` | your API domain |
| `TEST_FRONTEND_HOST` | your frontend domain |

### 7. Update secrets before going live (production)

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
| API task CPU | 256 (0.25 vCPU) | 512 (0.5 vCPU) |
| API task memory | 512 MB | 1024 MB |
| API desired count | 1 | 2 |
| API max count | 5 | 20 |
| Frontend desired count | 1 | 2 |
| RDS class | db.t3.micro | db.t3.small |
| RDS storage | 20 GB | 100 GB |
| NAT gateways | 1 (single) | 3 (one per AZ) |
| RDS deletion protection | No | Yes |
| RDS final snapshot | No | Yes |
| Performance Insights | No | Yes |
| ECR image retention | 20 | 50 |
| CORS origin for thumbnails | `*` | `https://app.slingshot.dev` |

## Module versions

| Module | Version |
|--------|---------|
| `terraform-aws-modules/vpc/aws` | `~> 5.0` |

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
├── outputs.tf           # Key outputs (ALB, ECS cluster, ECR, RDS, CI credentials)
├── vpc.tf               # VPC, subnets, NAT, IGW, route tables
├── ecs.tf               # ECS cluster, task definitions, services, auto-scaling
├── alb.tf               # Application Load Balancer, target groups, listeners
├── acm.tf               # ACM certificate and DNS validation
├── ecr.tf               # ECR repositories and lifecycle policies
├── rds.tf               # RDS PostgreSQL, subnet group, security group
├── redis.tf             # ElastiCache Redis, subnet group, security group
├── s3.tf                # Event thumbnails bucket, CORS, public-read policy
├── iam.tf               # CI/CD IAM user, ECS task execution role, API task role
├── ssm.tf               # Application secrets in SSM Parameter Store
├── environments/
│   ├── test.tfvars          # Test ring variable overrides
│   ├── prod.tfvars          # Production variable overrides
│   ├── test-backend.tfvars  # S3 backend config for test state
│   └── prod-backend.tfvars  # S3 backend config for prod state
└── scripts/
    └── bootstrap-state.sh   # One-time S3 + DynamoDB state backend setup
```
