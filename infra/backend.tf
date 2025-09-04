terraform {
  backend "s3" {
    bucket       = "terraform-state-bucket-sidekick-prod"
    key          = "sidekick/terraform.tfstate"
    region       = "us-west-2"
    encrypt      = true
  }
}
