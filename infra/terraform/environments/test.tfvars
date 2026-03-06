environment = "test"
aws_region  = "us-east-1"

# Allow all origins in test (frontend domain not fixed)
image_bucket_cors_origins = ["*"]

# EKS node role needs s3:PutObject on image bucket for presigned URL uploads
api_iam_role_name = "ticket-platform-eks-node-role"
