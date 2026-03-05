terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

# Default provider (deploys most resources)
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "ticket-platform"
      Component = "image-pipeline"
      ManagedBy = "terraform"
    }
  }
}

# Lambda@Edge MUST be deployed in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "ticket-platform"
      Component = "image-pipeline"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
