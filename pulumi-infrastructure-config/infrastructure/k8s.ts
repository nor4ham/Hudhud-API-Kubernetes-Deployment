import * as alicloud from "@pulumi/alicloud";
import * as pulumi from "@pulumi/pulumi";
import { privateSubnetA, privateSubnetB, privateRT, vpc } from "./vpc";
import { sg as vpnSG } from "./vpn";
 
interface k8sConfig {
  version: string;
  users: User[];
  containerdVersion: string;
  imageId: string;
  imageType: string;
}

interface User {
  id: string;
  role: string;
}

const config = new pulumi.Config();
const k8sConfig = config.requireObject<k8sConfig>("k8s");



k8sConfig.users.forEach((user) => {
  new alicloud.cs.KubernetesPermission(user.id, {
    permissions: [
      { roleName: user.role, roleType: "cluster", cluster: "cd567026d500f4dfe9a554284de53891b" },
    ],
    uid: user.id,
  });
});

new alicloud.ecs.SecurityGroupRule("k8s-vpn-to-node", {
  securityGroupId: "sg-l4vb7oatc4da0t3uaewk",
  ipProtocol: "all",
  sourceSecurityGroupId: vpnSG.id,
  type: "ingress",
});

new alicloud.ecs.SecurityGroupRule("k8s-node-to-vpn", {
  securityGroupId: vpnSG.id,
  ipProtocol: "all",
  sourceSecurityGroupId: "sg-l4vb7oatc4da0t3uaewk",
  type: "ingress",
});

new alicloud.ecs.SecurityGroupRule("k8s-all-egress", {
  securityGroupId: "sg-l4vb7oatc4da0t3uaewk",
  ipProtocol: "all",
  cidrIp: "0.0.0.0/0",
  type: "egress",
});

const poolA = new alicloud.cs.NodePool(
  "pool-a",
  {
    clusterId: "sg-l4vb7oatc4da0t3uaewk",
    imageType: k8sConfig.imageType,
    imageId: k8sConfig.imageId,
    systemDiskCategory: "cloud_essd",
    systemDiskSize: 40,
    instanceChargeType: "PostPaid",
    instanceTypes: ["ecs.g6.xlarge"],
    name: "pool-a",
    desiredSize: 2,
    runtimeName: "containerd",
    runtimeVersion: k8sConfig.containerdVersion,
    installCloudMonitor: false,
    vswitchIds: [privateSubnetB.id, privateSubnetA.id],
    keyName: "vpn",
    labels: [{ key: "workload_type", value: "cpu" }],
    systemDiskPerformanceLevel: "PL1",
  },
  { ignoreChanges: ["spotStrategy", "desiredSize"] }
);

export const sgA = poolA.scalingGroupId;

const poolB = new alicloud.cs.NodePool(
  "pool-b",
  {
    clusterId: "sg-l4vb7oatc4da0t3uaewk",
    imageType: k8sConfig.imageType,
    imageId: k8sConfig.imageId,
    systemDiskCategory: "cloud_essd",
    systemDiskSize: 40,
    instanceChargeType: "PostPaid",
    instanceTypes: ["ecs.g6.xlarge"],
    name: "pool-b",
    runtimeName: "containerd",
    runtimeVersion: k8sConfig.containerdVersion,
    desiredSize: 2,
    installCloudMonitor: false,
    vswitchIds: [privateSubnetB.id, privateSubnetA.id],
    keyName: "vpn",
    labels: [{ key: "workload_type", value: "cpu" }],
    systemDiskPerformanceLevel: "PL1",
  },
  { ignoreChanges: ["spotStrategy", "desiredSize"] }
);
export const sgB = poolB.scalingGroupId;

const autoscalerUser = new alicloud.ram.User("autoscaler", {
  name: "autoscaler",
});

const policy = new alicloud.ram.Policy("autoscaler", {
  policyName: "autoscaler",
  policyDocument: `{
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
}`,
});
new alicloud.ram.UserPolicyAttachment("autoscaler", {
  userName: autoscalerUser.name,
  policyName: policy.policyName,
  policyType: "Custom",
});

const key = new alicloud.ram.AccessKey("autoscaler", {
  userName: autoscalerUser.name,
  secretFile: "autoscaler.key",
});



