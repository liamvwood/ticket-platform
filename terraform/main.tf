terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Partial backend — supply the rest with:
  #   terraform init -backend-config=environments/test-backend.tfvars
  backend "s3" {}
}

# ── AWS provider ───────────────────────────────────────────────────────────────
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ticket-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ── Kubernetes + Helm providers (connect to EKS after cluster creation) ────────
data "aws_eks_cluster" "this" {
  name       = module.eks.cluster_name
  depends_on = [module.eks]
}

data "aws_eks_cluster_auth" "this" {
  name       = module.eks.cluster_name
  depends_on = [module.eks]
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.this.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.this.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.this.token
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.this.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.this.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.this.token
  }
}

# ── Data sources ───────────────────────────────────────────────────────────────
data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

# ── Locals ─────────────────────────────────────────────────────────────────────
locals {
  name       = "ticket-platform-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id
  azs        = slice(data.aws_availability_zones.available.names, 0, 3)
  vpc_cidr   = "10.0.0.0/16"

  # Kubernetes namespace matches the Helm release namespace used by the CI pipeline
  app_namespace = "ticket-platform-${var.environment}"
}
