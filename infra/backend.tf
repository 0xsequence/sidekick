terraform {
  backend "s3" {
    bucket       = "terraform-state-bucket-sidekick"
    key          = "sidekick/terraform.tfstate"
    region       = "us-west-2"
    encrypt      = true
  }
}
