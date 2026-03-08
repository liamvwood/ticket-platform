#!/usr/bin/env bash
# sync-github-secrets.sh — reads Terraform outputs and pushes them to GitHub
# Actions environment secrets so the CI/CD pipeline can deploy without any
# manual secret management.
#
# Prerequisites:
#   - terraform apply has been run for the target environment
#   - gh CLI is installed and authenticated (gh auth login)
#   - AWS CLI is configured with credentials that can read SSM parameters
#
# Usage (run from the repo root or terraform/ directory):
#   bash terraform/scripts/sync-github-secrets.sh --env test
#   bash terraform/scripts/sync-github-secrets.sh --env prod
#
# The script is idempotent — safe to run after every terraform apply.

set -euo pipefail

# ── Argument parsing ───────────────────────────────────────────────────────────
ENVIRONMENT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENVIRONMENT="$2"; shift 2 ;;
    *)     echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "$ENVIRONMENT" ]]; then
  echo "Usage: $0 --env <test|prod>"
  exit 1
fi

if [[ "$ENVIRONMENT" != "test" && "$ENVIRONMENT" != "prod" ]]; then
  echo "❌ --env must be 'test' or 'prod', got: $ENVIRONMENT"
  exit 1
fi

# ── Locate terraform directory ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Detect GitHub repo from git remote ────────────────────────────────────────
REPO=$(git -C "$TF_DIR" remote get-url origin \
  | sed -E 's|.*github\.com[:/]||; s|\.git$||')
if [[ -z "$REPO" ]]; then
  echo "❌ Could not detect GitHub repository from git remote."
  exit 1
fi

echo "Syncing Terraform outputs → GitHub secrets"
echo "  Environment : $ENVIRONMENT"
echo "  Repository  : $REPO"
echo "  Terraform   : $TF_DIR"
echo ""

# ── Initialise Terraform state for the target environment ─────────────────────
cd "$TF_DIR"
echo "Initialising Terraform backend for '$ENVIRONMENT'..."
terraform init -backend-config="environments/${ENVIRONMENT}-backend.tfvars" \
  -reconfigure -input=false -no-color > /dev/null

echo "Selecting workspace / refreshing state..."
terraform workspace select default -or-create 2>/dev/null || true

# ── Read outputs ───────────────────────────────────────────────────────────────
echo "Reading outputs..."
AWS_REGION=$(terraform output -raw aws_region)
ECR_REGISTRY=$(terraform output -raw ecr_registry)
ECS_CLUSTER=$(terraform output -raw ecs_cluster_name)
CI_ACCESS_KEY_ID=$(terraform output -raw ci_access_key_id)
CI_SECRET_ACCESS_KEY=$(terraform output -raw ci_secret_access_key)
API_HOST=$(terraform output -raw api_domain)
FRONTEND_HOST=$(terraform output -raw frontend_domain)

echo ""
echo "Values to sync:"
echo "  AWS_REGION          = $AWS_REGION"
echo "  ECR_REGISTRY        = $ECR_REGISTRY"
echo "  ECS_CLUSTER         = $ECS_CLUSTER"
echo "  AWS_ACCESS_KEY_ID   = ${CI_ACCESS_KEY_ID:0:8}…  (truncated)"
echo "  AWS_SECRET_ACCESS_KEY = *** (hidden)"
echo "  TEST_API_HOST       = $API_HOST"
echo "  TEST_FRONTEND_HOST  = $FRONTEND_HOST"
echo ""

# ── Push secrets to GitHub environment ────────────────────────────────────────
set_secret() {
  local name="$1"
  local value="$2"
  printf '%s' "$value" | gh secret set "$name" \
    --env "$ENVIRONMENT" \
    --repo "$REPO"
  echo "  ✅ $name"
}

echo "Pushing secrets to GitHub environment '$ENVIRONMENT'..."
set_secret "AWS_REGION"             "$AWS_REGION"
set_secret "ECR_REGISTRY"           "$ECR_REGISTRY"
set_secret "ECS_CLUSTER"            "$ECS_CLUSTER"
set_secret "AWS_ACCESS_KEY_ID"      "$CI_ACCESS_KEY_ID"
set_secret "AWS_SECRET_ACCESS_KEY"  "$CI_SECRET_ACCESS_KEY"
set_secret "TEST_API_HOST"          "$API_HOST"
set_secret "TEST_FRONTEND_HOST"     "$FRONTEND_HOST"

echo ""
echo "✅ All secrets synced. Re-run after every 'terraform apply' to keep them up to date."
