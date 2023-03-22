import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';

export class RDSStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DemoVPC', {
        vpcName: 'demo-vpc',
      });
    const securityGroup = ec2.SecurityGroup.fromLookupByName(this, 'DemoSG', 'demo-sg', vpc);

    const instance = new rds.DatabaseInstance(this, 'DemoRDS', {
        engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_21
        }),
        vpc,
        securityGroup,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
        masterUsername: 'admin',
        masterUserPassword: cdk.SecretValue.plainText('password'),
        deletionProtection: false
    });

    new cdk.CfnOutput(this, 'DemoRDSEndpoint', {
        value: instance.instanceEndpoint.hostname
    });
  }
}
