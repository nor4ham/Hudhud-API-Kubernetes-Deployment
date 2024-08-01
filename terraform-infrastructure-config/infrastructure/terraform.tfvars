region = "me-central-1"

vpc_config = {
  cidr = "10.0.0.0/16"
  subnets = [
    { cidr = "10.0.1.0/24", name = "private-a", zone = "me-central-1a" },
    { cidr = "10.0.2.0/24", name = "private-b", zone = "me-central-1b" },
    { cidr = "10.0.128.0/24", name = "public-a", zone = "me-central-1a" },
    { cidr = "10.0.129.0/24", name = "public-b", zone = "me-central-1b" }
  ]
}

vpn_config = {
  enableSSH    = true
  instanceType = "ecs.g6.large"
}

k8s_config = {
  version           = "1.28.3-aliyun.1"
  containerdVersion = "1.6.21"
  imageId           = "aliyun_3_x64_20G_alibase_20230727.vhd"
  imageType         = "AliyunLinux3"
  users = [
    { id = "219480215164621764", role = "dev" },
    { id = "212013015163382359", role = "admin" }
  ]
}

db = {
  hudhud = {
    databases         = ["hudhud", "hudhud_keycloak"]
    instance_type     = "pg.x2.medium.2c"
    size              = 200
    instance_charge_type = "Postpaid"
  }
}

account_id = "5507915163376274"

buckets = [
  {
    name = "bucket1-unique-name"
    acl  = "private"
  },
  {
    name = "bucket2-unique-name"
    acl  = "public-read"
  }
]
