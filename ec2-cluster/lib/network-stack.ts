import * as cdk from '@aws-cdk-lib/core';
import * as ec2 from '@aws-cdk-lib/aws-ec2';

export class VPCStack extends cdk.Stack {

    public readonly vpc: ec2.Vpc;
    
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'EC2VPC', {
        vpcName: 'demo-vpc',
        cidr: '10.0.0.0/16',
        maxAzs: 2,
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'public',
            subnetType: ec2.SubnetType.PUBLIC,
          },
          {
            cidrMask: 24,
            name: 'private',
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
        ],
      });
      const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
        securityGroupName: 'demo-sg',
        vpc,
        description: 'Allow SSH (TCP port 22) in',
        allowAllOutbound: true
      });
      securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access')  
  }
}
