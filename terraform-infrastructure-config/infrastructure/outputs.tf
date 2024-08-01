output "vpc_id" {
  value = alicloud_vpc.main.id
}

output "private_subnet_a_id" {
  value = alicloud_vswitch.private_a.id
}

output "private_subnet_b_id" {
  value = alicloud_vswitch.private_b.id
}

output "public_subnet_a_id" {
  value = alicloud_vswitch.public_a.id
}

output "public_subnet_b_id" {
  value = alicloud_vswitch.public_b.id
}

output "vpn_security_group_id" {
  value = alicloud_security_group.vpn_sg.id
}

output "autoscaler_user_name" {
  value = alicloud_ram_user.autoscaler.name
}

output "autoscaler_policy_name" {
  value = alicloud_ram_policy.autoscaler_policy.policy_name
}

output "autoscaler_access_key_id" {
  value = alicloud_ram_access_key.autoscaler_access_key.id
}

output "autoscaler_access_key_secret" {
  value     = alicloud_ram_access_key.autoscaler_access_key.secret
  sensitive = true
}

output "hudhud_DBconnectoion_string" {
  value = alicloud_db_instance.hudhud.connection_string
}

output "hudhud_DBpassword" {
  value = [for idx in range(length(var.db.hudhud.databases)) : {
    database = var.db.hudhud.databases[idx]
    password = random_password.db_passwords[idx].result
  }]
  sensitive = true
}

output "kvstore_instance_id" {
  value = alicloud_kvstore_instance.hudhud.id
}

output "kvstore_instance_connection_string" {
  value = alicloud_kvstore_instance.hudhud.connection_string
}

output "kvstore_instance_port" {
  value = alicloud_kvstore_instance.hudhud.port
}

output "buckets_configs" {
  value = [
    for config in local.bucket_configs : {
      endpoint  = "${alicloud_oss_bucket.buckets[config.bucket_name].bucket}.${alicloud_oss_bucket.buckets[config.bucket_name].extranet_endpoint}"
      key_id    = alicloud_ram_access_key.access_keys[config.user_name].id
      key_secret= alicloud_ram_access_key.access_keys[config.user_name].secret
      bucket    = alicloud_oss_bucket.buckets[config.bucket_name].bucket
    }
  ]
  sensitive = true
}
