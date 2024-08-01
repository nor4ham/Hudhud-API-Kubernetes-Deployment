import * as alicloud from "@pulumi/alicloud";
import * as pulumi from "@pulumi/pulumi";
import { privateSubnetA, privateSubnetB, VPCConfig } from "./vpc";
import * as random from "@pulumi/random";

interface DB {
  common: Database;
}

interface Database {
  databases: string[];
  instanceType: string;
  size: number;
  instanceChargeType: "Postpaid" | "Prepaid";
}

const config = new pulumi.Config();
const db = config.requireObject<DB>("db");
const vpcConfig = config.requireObject<VPCConfig>("vpc");
const accountId = config.require("accountId");

if (!db || !db.common || !db.common.instanceType) {
  throw new Error("Database configuration is missing or incorrect");
}

const common = new alicloud.rds.Instance("common", {
  engine: "PostgreSQL",
  vswitchId: privateSubnetA.id, // Switch to another subnet if required
  engineVersion: "15.0",
  instanceType: db.common.instanceType,
  category: "HighAvailability",
  instanceStorage: db.common.size,
  instanceChargeType: db.common.instanceChargeType,
  autoRenew: db.common.instanceChargeType === "Prepaid" ? true : undefined,
  dbInstanceStorageType: "cloud_essd",
  instanceName: "common",
  securityIps: [vpcConfig.cidr, "127.0.0.1"],
  roleArn: `acs:ram::${accountId}:role/AliyunRDSDefaultRole`
});

// Create databases and users
const passwords: { database: string; password: pulumi.Output<string> }[] = [];
db.common.databases.forEach(database => {
  const dbDetails = createDatabase(database, common.id);
  passwords.push({ database, password: dbDetails.password.result });
});

// Export the connection string and passwords
export const commonDBConnectionString = common.connectionString;
export const passwordsOutput = passwords;

function createDatabase(name: string, instanceId: pulumi.Input<string>) {
  const password = new random.RandomPassword(name, {
    length: 16,
    overrideSpecial: "^-%()",
    special: true,
  });

  const user = new alicloud.rds.Account(name, {
    accountName: name,
    accountPassword: password.result,
    accountType: "Super",
    dbInstanceId: instanceId,
  });

  const db = new alicloud.rds.Database(name, {
    instanceId: instanceId,
    name: name,
  }, { ignoreChanges: ["characterSet"] });

  new alicloud.rds.AccountPrivilege(name, {
    accountName: user.accountName,
    privilege: "DBOwner",
    instanceId: instanceId,
    dbNames: [db.name],
  });

  return { password };
}
