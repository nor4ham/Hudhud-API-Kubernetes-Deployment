provider "alicloud" {
  region = var.region
}

# Create the VPC
resource "alicloud_vpc" "main" {
  vpc_name  = "staging-vpc"
  cidr_block = var.vpc_config.cidr
}

# Create the subnets
resource "alicloud_vswitch" "private_a" {
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = var.vpc_config.subnets[0].cidr
  zone_id      = "me-central-1a" # Update to a zone that supports KVStore
  vswitch_name = var.vpc_config.subnets[0].name
}

resource "alicloud_vswitch" "private_b" {
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = var.vpc_config.subnets[1].cidr
  zone_id      = "me-central-1b" # Update to a zone that supports KVStore
  vswitch_name = var.vpc_config.subnets[1].name
}

resource "alicloud_vswitch" "public_a" {
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = var.vpc_config.subnets[2].cidr
  zone_id      = "me-central-1a"
  vswitch_name = var.vpc_config.subnets[2].name
}

resource "alicloud_vswitch" "public_b" {
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = var.vpc_config.subnets[3].cidr
  zone_id      = "me-central-1b"
  vswitch_name = var.vpc_config.subnets[3].name
}

# VPN Security Group
resource "alicloud_security_group" "vpn_sg" {
  name        = "vpn-sg"
  description = "Security group for VPN"
  vpc_id      = alicloud_vpc.main.id
}

resource "alicloud_security_group" "source_sg" {
  name        = "source-sg"
  description = "Source security group"
  vpc_id      = alicloud_vpc.main.id
}

# Security Group Rules for VPN
resource "alicloud_security_group_rule" "vpn_ingress" {
  type                    = "ingress"
  ip_protocol             = "all"
  security_group_id       = alicloud_security_group.vpn_sg.id
  source_security_group_id = alicloud_security_group.source_sg.id
}

resource "alicloud_security_group_rule" "vpn_egress" {
  type              = "egress"
  ip_protocol       = "all"
  security_group_id = alicloud_security_group.vpn_sg.id
  cidr_ip           = "0.0.0.0/0"
}

# Autoscaler User and Policy (use existing ones)
resource "alicloud_ram_user" "autoscaler" {
  name = "autoscaler"
}

resource "alicloud_ram_policy" "autoscaler_policy" {
  policy_name     = "autoscaler"
  policy_document = <<POLICY
{
  "Version": "1",
  "Statement": [
    {
      "Action": [
        "ess:Describe*",
        "ess:CreateScalingRule",
        "ess:ModifyScalingGroup",
        "ess:RemoveInstances",
        "ess:ExecuteScalingRule",
        "ess:ModifyScalingRule",
        "ess:DeleteScalingRule",
        "ess:DetachInstances",
        "ecs:DescribeInstanceTypes"
      ],
      "Resource": [
        "*"
      ],
      "Effect": "Allow"
    }
  ]
}
POLICY
}

resource "alicloud_ram_user_policy_attachment" "autoscaler_policy_attachment" {
  user_name  = alicloud_ram_user.autoscaler.name
  policy_name = alicloud_ram_policy.autoscaler_policy.policy_name
  policy_type = "Custom"
}

resource "alicloud_ram_access_key" "autoscaler_access_key" {
  user_name = alicloud_ram_user.autoscaler.name
}

# Create the RDS instance with a smaller instance type
resource "alicloud_db_instance" "hudhud" {
  engine            = "PostgreSQL"
  vswitch_id        = alicloud_vswitch.private_a.id
  engine_version    = "16.0"
  instance_type     = "pg.x2.large.2c" 
  instance_storage  = var.db.hudhud.size
  instance_name     = "hudhud"
  security_ips      = [var.vpc_config.cidr, "127.0.0.1"]
  instance_charge_type = var.db.hudhud.instance_charge_type
  category          = "HighAvailability"
  db_instance_storage_type = "cloud_essd"
  
  tags = {
    Name = "hudhud"
    Environment = "staging"
  }

  auto_renew = var.db.hudhud.instance_charge_type == "Prepaid" ? true : false
  role_arn   = "acs:ram::${var.account_id}:role/AliyunRDSDefaultRole"
}

resource "random_password" "db_passwords" {
  count  = length(var.db.hudhud.databases)
  length = 16
  special = true
  override_special = "^-%()"
}

resource "alicloud_db_account" "db_accounts" {
  count           = length(var.db.hudhud.databases)
  account_name    = element(var.db.hudhud.databases, count.index)
  account_password = random_password.db_passwords[count.index].result
  db_instance_id  = alicloud_db_instance.hudhud.id
  account_type    = "Super"
}

resource "alicloud_db_database" "databases" {
  count        = length(var.db.hudhud.databases)
  instance_id  = alicloud_db_instance.hudhud.id
  name         = element(var.db.hudhud.databases, count.index)
}

resource "alicloud_db_account_privilege" "account_privileges" {
  count          = length(var.db.hudhud.databases)
  account_name   = element(var.db.hudhud.databases, count.index)
  instance_id    = alicloud_db_instance.hudhud.id
  db_names       = [element(var.db.hudhud.databases, count.index)]
  privilege      = "DBOwner"
}
 
# Create the KVStore instance with a smaller instance type
resource "alicloud_kvstore_instance" "hudhud" {
  vswitch_id          = alicloud_vswitch.private_a.id
  security_ips        = ["127.0.0.1", var.vpc_config.cidr]
  instance_name       = "hudhud"
  instance_class      = "redis.master.small.default"
  engine_version      = "5.0"
  period              = 1
  instance_charge_type= "PrePaid"
  auto_renew          = false
}

# Iterate over the list of buckets to create resources
locals {
  bucket_configs = [
    for bucket in var.buckets : {
      user_name = bucket.name
      bucket_name = bucket.name
      acl = bucket.acl
    }
  ]
}

# Create RAM users, OSS buckets, policies, and access keys
resource "alicloud_ram_user" "bucket_users" {
  for_each = { for config in local.bucket_configs : config.user_name => config }

  name = each.value.user_name
}

resource "alicloud_oss_bucket" "buckets" {
  for_each = { for config in local.bucket_configs : config.bucket_name => config }

  bucket = each.value.bucket_name
  acl    = each.value.acl

  policy = jsonencode({
    Statement = [
      {
        Action    = ["oss:*"]
        Effect    = "Allow"
        Principal = ["acs:ram::${alicloud_ram_user.bucket_users[each.value.user_name].id}:root"]
        Resource  = [
          "acs:oss:*:*:${each.value.bucket_name}",
          "acs:oss:*:*:${each.value.bucket_name}/*"
        ]
      }
    ]
    Version = "1"
  })
}

resource "alicloud_ram_access_key" "access_keys" {
  for_each = { for config in local.bucket_configs : config.user_name => config }

  user_name   = each.value.user_name
  secret_file = each.value.user_name
}

# Create a Container Service for Kubernetes (ACK) managed cluster.
resource "alicloud_cs_managed_kubernetes" "default" {
  name                   = "my-k8s-cluster"
  cluster_spec           = "ack.pro.small"
  is_enterprise_security_group = true
  pod_cidr               = "172.20.0.0/16"
  service_cidr           = "172.21.0.0/20"
  worker_vswitch_ids     = [alicloud_vswitch.private_a.id, alicloud_vswitch.private_b.id]
}

# Create a node pool that is associated with a deployment set in the cluster.
resource "alicloud_cs_kubernetes_node_pool" "test" {
  name                  = "tf-deploymentset"
  cluster_id            = alicloud_cs_managed_kubernetes.default.id
  vswitch_ids           = [alicloud_vswitch.private_a.id, alicloud_vswitch.private_b.id]
  instance_types        = ["ecs.c6.large", "ecs.c5.large"]
  system_disk_category  = "cloud_ssd"
  system_disk_size      = 120
  instance_charge_type  = "PostPaid"
  security_group_id     = alicloud_security_group.vpn_sg.id
  install_cloud_monitor = true
  platform              = "AliyunLinux"
  image_id              = "aliyun_2_1903_x64_20G_alibase_20210726.vhd"
  password              = "Hello1234"
  node_count            = 2
}
