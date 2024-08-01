variable "region" {
  description = "The region for Alicloud resources"
  type        = string
  default     = "me-central-1"
}

variable "name" {
  description = "Name for the resources"
  type        = string
  default     = "tf-test"
}

variable "vpc_config" {
  description = "VPC configuration"
  type = object({
    cidr    = string
    subnets = list(object({
      cidr = string
      name = string
      zone = string
    }))
  })
  default = {
    cidr = "10.0.0.0/16" 
    subnets = [
      { cidr = "10.0.1.0/24", name = "private-a", zone = "me-central-1a" },
      { cidr = "10.0.2.0/24", name = "private-b", zone = "me-central-1b" },
      { cidr = "10.0.128.0/24", name = "public-a", zone = "me-central-1a" },
      { cidr = "10.0.129.0/24", name = "public-b", zone = "me-central-1b" }
    ]
  }
}

variable "vpn_config" {
  description = "VPN configuration"
  type = object({
    enableSSH    = bool
    instanceType = string
  })
  default = {
    enableSSH    = true
    instanceType = "ecs.g6.large"
  }
}

variable "k8s_config" {
  description = "Kubernetes cluster configuration"
  type = object({
    version            = string
    users              = list(object({ id = string, role = string }))
    containerdVersion  = string
    imageId            = string
    imageType          = string
  })
}

variable "db" {
  description = "Database configuration"
  type = object({
    hudhud = object({
      databases         = list(string)
      instance_type     = string
      size              = number
      instance_charge_type = string
    })
  })
}

variable "buckets" {
  description = "List of buckets with name and ACL"
  type = list(object({
    name = string
    acl  = string
  }))
}

variable "account_id" {
  description = "The Alicloud account ID"
  type        = string
}
