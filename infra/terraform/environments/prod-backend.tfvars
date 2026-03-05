# Replace <ACCOUNT_ID> with your 12-digit AWS account ID
bucket         = "ticket-platform-tf-state-<ACCOUNT_ID>"
key            = "prod/image-pipeline.tfstate"
region         = "us-east-1"
dynamodb_table = "ticket-platform-tf-locks"
encrypt        = true
