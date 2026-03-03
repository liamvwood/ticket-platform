module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = local.name
  cidr = local.vpc_cidr

  azs             = local.azs
  private_subnets = [for i, _ in local.azs : cidrsubnet(local.vpc_cidr, 4, i)]
  public_subnets  = [for i, _ in local.azs : cidrsubnet(local.vpc_cidr, 4, i + 4)]

  enable_nat_gateway     = var.enable_nat_gateway
  single_nat_gateway     = var.single_nat_gateway
  enable_dns_hostnames   = true
  enable_dns_support     = true

  # Required for EKS to discover subnets when provisioning load balancers
  public_subnet_tags = {
    "kubernetes.io/role/elb"                      = "1"
    "kubernetes.io/cluster/${local.name}"          = "shared"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"             = "1"
    "kubernetes.io/cluster/${local.name}"          = "shared"
  }
}
