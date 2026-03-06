# Package the image-transformer source
data "archive_file" "image_transformer" {
  type        = "zip"
  source_dir  = "${path.module}/../image-transformer"
  output_path = "${path.module}/image-transformer.zip"
  excludes    = ["test", "*.test.js"]
}

# Lambda@Edge functions must be deployed in us-east-1
resource "aws_lambda_function" "image_transformer" {
  provider = aws.us_east_1

  function_name    = "ticket-platform-${var.environment}-image-transformer"
  role             = aws_iam_role.lambda_edge_image.arn
  handler          = "handler.handler"
  runtime          = "nodejs20.x"
  publish          = true  # Lambda@Edge requires a published version
  filename         = data.archive_file.image_transformer.output_path
  source_code_hash = data.archive_file.image_transformer.output_base64sha256

  memory_size = 512
  timeout     = 10
}
