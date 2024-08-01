import * as alicloud from "@pulumi/alicloud";
import * as pulumi from "@pulumi/pulumi";
import { privateSubnetA, VPCConfig } from "./vpc";

const config = new pulumi.Config();
const name = config.require("name");

const vcpConfig = config.requireObject<VPCConfig>("vpc");

  const hudhud = new alicloud.kvstore.Instance("hudhud", {
    vswitchId: privateSubnetA.id,
    securityIps: ["127.0.0.1", vcpConfig.cidr],
    dbInstanceName: "hudhud",
    instanceType: "Redis",
    paymentType: "PrePaid",
    period: "1",
    autoRenew: true,
    engineVersion: "5.0",
    instanceClass: "redis.master.small.default",
    vpcAuthMode: "Close",
  });


