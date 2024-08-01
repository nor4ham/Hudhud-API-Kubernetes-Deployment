import * as alicloud from "@pulumi/alicloud";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const buckets = config.requireObject<Bucket[]>("buckets");

interface Bucket {
  name: string;
  acl: string;
}

const data: { 
  endpoint: pulumi.Output<string>;
  keyId: pulumi.Output<string>;
  keySecret: pulumi.Output<string>;
  bucket: pulumi.Output<string | undefined>;
}[] = [];

buckets.forEach((bucket) => {
  const user = new alicloud.ram.User(bucket.name, {
    name: bucket.name,
  });

  const b = new alicloud.oss.Bucket(bucket.name, {
    bucket: bucket.name,
    acl: bucket.acl,
    policy: pulumi.interpolate`{"Statement":
    [{"Action":
        ["oss:*"],
      "Effect":"Allow",
      "Principal": ["${user.id}"],
      "Resource":
            ["acs:oss:*:*:${bucket.name}","acs:oss:*:*:${bucket.name}/*"]
          }],
 "Version":"1"}`,
  });

  const key = new alicloud.ram.AccessKey(bucket.name, {
    userName: user.name,
    secretFile: bucket.name,
  });

  data.push({
    endpoint: pulumi.interpolate`${b.bucket}.${b.extranetEndpoint}`,
    keyId: key.id,
    keySecret: key.secret,
    bucket: b.bucket,
  });
});

export const bucketsConfigs = data;