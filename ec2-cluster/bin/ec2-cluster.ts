#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EC2Stack } from '../lib/ec2-cluster-stack';
import { VPCStack } from '../lib/network-stack';
import { RDSStack } from '../lib/rds-stack';

const app = new cdk.App();

new VPCStack(app, 'VPCStack', {});
new RDSStack(app, 'RDSStack', {});
new EC2Stack(app, 'EC2Stack', {});

app.synth();