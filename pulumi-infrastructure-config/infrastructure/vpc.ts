import * as alicloud from "@pulumi/alicloud";
import * as pulumi from "@pulumi/pulumi";

export interface VPCConfig {
  cidr: string;
  subnets: Subnet[];
}
interface Subnet {
  cidr: string;
  zone: string;
  name: string;
}
const config = new pulumi.Config();
const name = config.require("name");
const vcpConfig = config.requireObject<VPCConfig>("vpc");

export const vpc = new alicloud.vpc.Network(name, {
  cidrBlock: vcpConfig.cidr,
});

export const privateRT = new alicloud.vpc.RouteTable("private", {
  vpcId: vpc.id,
  routeTableName: "private",
});

const publicRT = new alicloud.vpc.RouteTable("public", {
  vpcId: vpc.id,
  routeTableName: "public",
});

export const privateSubnetA = createSubnet(
  vcpConfig.subnets.find((s) => s.name == "private-a"),
  "private-a"
);

export const privateSubnetB = createSubnet(
  vcpConfig.subnets.find((s) => s.name == "private-b"),
  "private-b"
);

export const publicSubnetA = createSubnet(
  vcpConfig.subnets.find((s) => s.name == "public-a"),
  "public-a"
);

const publicSubnetB = createSubnet(
  vcpConfig.subnets.find((s) => s.name == "public-b"),
  "public-b"
);

const nat = new alicloud.vpc.NatGateway("nat", {
  vpcId: vpc.id,
  natGatewayName: `${name}`,
  paymentType: "PayAsYouGo",
  networkType: "internet",
  vswitchId: publicSubnetA.id,
  internetChargeType: "PayByLcu",
  natType: "Enhanced",
});

const natEIP = new alicloud.ecs.EipAddress("nat", {
  internetChargeType: "PayByTraffic",
  bandwidth: "200",
  addressName: "nat",
  paymentType: "PayAsYouGo",
});

new alicloud.ecs.EipAssociation("nat", {
  instanceId: nat.id,
  instanceType: "Nat",
  allocationId: natEIP.id,
});

new alicloud.vpc.SnatEntry("nat-a", {
  snatTableId: nat.snatTableIds,
  snatIp: natEIP.ipAddress,
  sourceVswitchId: privateSubnetA.id,
});

new alicloud.vpc.SnatEntry("nat-b", {
  snatTableId: nat.snatTableIds,
  snatIp: natEIP.ipAddress,
  sourceVswitchId: privateSubnetB.id,
});

new alicloud.vpc.RouteEntry("nat", {
  routeTableId: privateRT.id,
  nexthopId: nat.id,
  destinationCidrblock: "0.0.0.0/0",
  name: "NAT",
  nexthopType: "NatGateway",
});

function createSubnet(
  subnet: Subnet | undefined,
  name: string
): alicloud.vpc.Switch {
  if (subnet === undefined) throw new Error("No Subnet");

  const sn = new alicloud.vpc.Switch(name, {
    vpcId: vpc.id,
    vswitchName: subnet.name,
    cidrBlock: subnet.cidr,
    zoneId: subnet.zone,
  });

  new alicloud.vpc.RouteTableAttachment(name, {
    routeTableId: name.includes("private") ? privateRT.id : publicRT.id,
    vswitchId: sn.id,
  });
  return sn;
}