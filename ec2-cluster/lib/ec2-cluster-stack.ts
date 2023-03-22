import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';

export class EC2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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

    const role = new iam.Role(this, 'ec2Role', {
      roleName: 'demo-rc2-role',
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    })

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))

    // Use Latest Amazon Linux Image - CPU Type ARM64
    const ami = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      cpuType: ec2.AmazonLinuxCpuType.X86_64
    });

    const masterEIP = new ec2.CfnEIP(this, 'MasterNodeEIP');

    const masterNode = new ec2.Instance(this, 'MasterNode', {
      instanceName: 'master-node',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MEDIUM),
      machineImage: ami,
      securityGroup: securityGroup,
      keyName: 'nagi-demo',
      role: role,
    });

    new ec2.CfnEIPAssociation(this, 'MasterNodeEIPAssociation', {
      eip: masterEIP.ref,
      instanceId: masterNode.instanceId,
    });
    // const workerNode = new ec2.Instance(this, 'WorkerNode', {
    //   vpc,
    //   instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
    //   machineImage: ami,
    //   securityGroup: securityGroup,
    //   // keyName: key.keyPairName,
    //   role: role,
    // });
    const workerGroup = new autoscaling.AutoScalingGroup(this, 'WorkerGroup', {
      autoScalingGroupName: 'worker-node-ag',
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MEDIUM),
      machineImage: ami,
      vpc,
      securityGroup: securityGroup,
      keyName: 'nagi-demo',
      role: role,
      minCapacity: 1,
      maxCapacity: 3,
    });
  }
}
