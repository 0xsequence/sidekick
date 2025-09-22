variable "waf_name" {}
variable "waf_scope" {}
variable "waf_association_lb_arns" {
  type        = list(string)
  default     = []
}
variable "enable_waf_associations" {
  description = "Whether to enable WAF associations with ALBs"
  type        = bool
  default     = true
}