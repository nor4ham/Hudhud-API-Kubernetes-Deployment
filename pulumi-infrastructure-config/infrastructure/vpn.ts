import * as alicloud from "@pulumi/alicloud";
import * as pulumi from "@pulumi/pulumi";
import { vpc, publicSubnetA } from "./vpc";

const config = new pulumi.Config();
const name = config.require("name");

interface VpnConfig {
  instanceType: string;
  enableSSH: boolean;
}

const vpnConfig = config.requireObject<VpnConfig>("vpn");

let keypairName: pulumi.Output<string>;

const existingKeyPairs = alicloud.ecs.getKeyPairs({}).then(result => {
  const existing = result.keyPairs.find(kp => kp.keyPairName === "vpn");
  if (existing) {
    return existing.keyPairName;
  } else {
    const newKeyPair = new alicloud.ecs.KeyPair("vpn", {
      keyPairName: "vpn",
      keyFile: `${name}.pem`,
    });
    return newKeyPair.keyPairName;
  }
});

keypairName = pulumi.output(existingKeyPairs);

export const sg = new alicloud.ecs.SecurityGroup("vpn", {
  vpcId: vpc.id,
  name: "vpn",
  securityGroupType: "normal",
});

if (vpnConfig.enableSSH) {
  new alicloud.ecs.SecurityGroupRule("ssh", {
    securityGroupId: sg.id,
    ipProtocol: "tcp",
    cidrIp: "0.0.0.0/0",
    portRange: "22/22",
    type: "ingress",
  });
}

new alicloud.ecs.SecurityGroupRule("wg", {
  securityGroupId: sg.id,
  ipProtocol: "udp",
  cidrIp: "0.0.0.0/0",
  portRange: "51820/51820",
  type: "ingress",
});

new alicloud.ecs.SecurityGroupRule("egress", {
  securityGroupId: sg.id,
  ipProtocol: "all",
  cidrIp: "0.0.0.0/0",
  type: "egress",
});

const vm = new alicloud.ecs.Instance("vpn", {
  instanceName: "vpn",
  vswitchId: publicSubnetA.id,
  instanceType: vpnConfig.instanceType,
  instanceChargeType: "PrePaid",
  period: 1, // Add the period parameter
  periodUnit: "Month",
  autoRenewPeriod: 1,
  renewalStatus: "AutoRenewal",
  imageId: "ubuntu_22_04_x64_20G_alibase_20221130.vhd",
  systemDiskCategory: "cloud_essd",
  systemDiskSize: 40,
  securityGroups: [sg.id],
  keyName: keypairName,
});

const eip = new alicloud.ecs.EipAddress("vpn", {
  internetChargeType: "PayByTraffic",
  bandwidth: "50",
  addressName: "vpn",
  paymentType: "PayAsYouGo",
});

new alicloud.ecs.EipAssociation("vpn", {
  instanceId: vm.id,
  instanceType: "EcsInstance",
  allocationId: eip.id,
});
