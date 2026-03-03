#!/usr/bin/env bash
# bootstrap-state.sh — creates the S3 bucket and DynamoDB table used for
# Terraform remote state. Run ONCE per AWS account before the first terraform init.
#
# Usage:
#   export AWS_REGION=us-east-1
#   bash terraform/scripts/bootstrap-state.sh
#
# The script is idempotent — safe to run more than once.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="ticket-platform-tf-state-${ACCOUNT_ID}"
TABLE="ticket-platform-tf-locks"

echo "Bootstrap Terraform state backend"
echo "  Account : $ACCOUNT_ID"
echo "  Region  : $REGION"
echo "  Bucket  : $BUCKET"
echo "  Table   : $TABLE"
echo ""

# ── S3 bucket ──────────────────────────────────────────────────────────────────
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "✅ S3 bucket already exists: $BUCKET"
else
  echo "Creating S3 bucket..."
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi

  aws s3api put-bucket-versioning --bucket "$BUCKET" \
    --versioning-configuration Status=Enabled

  aws s3api put-bucket-encryption --bucket "$BUCKET" \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}
      }]
    }'

  aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  echo "✅ S3 bucket created and secured: $BUCKET"
fi

# ── DynamoDB table for state locking ──────────────────────────────────────────
if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" &>/dev/null; then
  echo "✅ DynamoDB table already exists: $TABLE"
else
  echo "Creating DynamoDB table..."
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"

  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
  echo "✅ DynamoDB table created: $TABLE"
fi

echo ""
echo "Update the backend.tfvars files replacing <ACCOUNT_ID> with: $ACCOUNT_ID"
echo ""
echo "Then initialise Terraform for each environment:"
echo "  terraform init -backend-config=environments/test-backend.tfvars"
echo "  terraform init -backend-config=environments/prod-backend.tfvars"
