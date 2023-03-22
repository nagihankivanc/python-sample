import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';

export class EC2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DemoVPC', {
      vpcName: 'demo-vpc',
    });
    const securityGroup = ec2.SecurityGroup.fromLookupByName(this, 'DemoSG', 'demo-sg', vpc);

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
      userData: MasterUserData.getMasterUserData(),
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
    //   userData: WorkerUserData.getWorkerUserData(),
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
      userData: WorkerUserData.getWorkerUserData(), 
    });

    const token = ec2.UserData.forLinux();
    token.addCommands(`cat /tmp/kubeadm-join-command.sh | grep -o -P '(?<=token).*(?=--)'`);
    const hash = ec2.UserData.forLinux();
    hash.addCommands(`cat /tmp/kubeadm-join-command.sh | sed 's/^.*hash //'`);

    const joinCommand = `kubeadm join ${masterNode.instancePrivateIp}:6443 --token ${token} --discovery-token-ca-cert-hash ${hash}`;

    workerGroup.addUserData(`echo '${joinCommand}' > /tmp/join-command`);
    workerGroup.addUserData('sudo sh -c "cat /tmp/join-command | sh"');

    masterNode.connections.allowFrom(workerGroup, ec2.Port.tcp(6443));
  }
}

export class MasterUserData {
  public static getMasterUserData(): ec2.UserData {
    const masterUserData = ec2.UserData.forLinux();
    masterUserData.addCommands(
      '#!/bin/bash',
      'sudo su',
      'sudo apt-get update && sudo apt-get upgrade -y',
      'sudo ufw allow 6443/tcp',
      'sudo ufw allow 2379/tcp',
      'sudo ufw allow 2380/tcp',
      'sudo ufw allow 10250/tcp',
      'sudo ufw allow 10251/tcp',
      'sudo ufw allow 10252/tcp',
      'sudo ufw allow 10255/tcp',
      'sudo ufw reload',
      'sudo apt-get install apt-transport-https ca-certificates curl -y',
      'sudo curl -fsSLo /etc/apt/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg',
      'echo "deb [signed-by=/etc/apt/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list',
      'sudo apt-get update && apt-get install -y kubeadm=1.21.1-00 kubelet=1.21.1-00 kubectl=1.21.1-00',
      'sudo apt-get install docker.io',
      'sudo systemctl start docker',
      'sudo systemctl enable docker',
      'sudo usermod -aG docker ec2-user',
      'systemctl enable --now kubelet',
      'swapoff -a',
      'sudo sysctl net.bridge.bridge-nf-call-iptables=1',
      'echo "apiVersion: kubeadm.k8s.io/v1beta2" > /tmp/kubeadm-config.yaml',
      'echo "kind: ClusterConfiguration" >> /tmp/kubeadm-config.yaml',
      'echo "kubernetesVersion: v1.21.2" >> /tmp/kubeadm-config.yaml',
      'echo "networking:" >> /tmp/kubeadm-config.yaml',
      'echo "  podSubnet: \"192.168.0.0/16\"" >> /tmp/kubeadm-config.yaml',
      'sudo kubeadm init --config=/tmp/kubeadm-config.yaml',
      'mkdir -p $HOME/.kube',
      'sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config',
      'sudo chown $(id -u):$(id -g) $HOME/.kube/config',
      'sudo export KUBECONFIG=/etc/kubernetes/admin.conf',
      'kubectl apply -f https://docs.projectcalico.org/v3.19/manifests/calico.yaml',
      'kubectl taint nodes --all node-role.kubernetes.io/master-',
      'kubeadm token create --print-join-command > /tmp/kubeadm-join-command.sh'
    );
    return masterUserData;
  }
}

export class WorkerUserData {
  public static getWorkerUserData(): ec2.UserData {
    const workerUserData = ec2.UserData.forLinux();
    workerUserData.addCommands(
      '#!/bin/bash',
      'sudo su',
      'sudo apt-get update && sudo apt-get upgrade -y',
      'sudo ufw allow 10251/tcp',
      'sudo ufw allow 10252/tcp',
      'sudo ufw reload',
      'sudo apt-get install apt-transport-https ca-certificates curl -y',
      'sudo curl -fsSLo /etc/apt/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg',
      'echo "deb [signed-by=/etc/apt/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list',
      'sudo apt-get update && apt-get install -y kubeadm=1.21.1-00 kubelet=1.21.1-00 kubectl=1.21.1-00',
      'sudo apt-get install docker.io',
      'sudo systemctl start docker',
      'sudo systemctl enable docker',
      'sudo usermod -aG docker ec2-user',
      'systemctl enable --now kubelet',
      'swapoff -a',
    );
    return workerUserData;
  }
}