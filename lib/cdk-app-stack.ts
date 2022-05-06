import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cdk from 'aws-cdk-lib';

export class CdkAppStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const vpc = new ec2.Vpc(this, 'vpc', {natGateways: 1});

    //creating a new application load balancer which is internet facing
    const alb = new elbv2.ApplicationLoadBalancer(this, 'alb', {
      vpc,
      internetFacing: true,
    });
    //added a listener which will face the internet as public on port 80 (enabling http access protocol)
    const listener = alb.addListener('Listener', {
      port: 80,
      open: true,
    });
    
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'sudo su',
      'yum install -y httpd',
      'systemctl start httpd',
      'systemctl enable httpd',
      //sets the "Hello World!" simple html header
      'echo "<h1>Hello World!</h1>" > /var/www/html/index.html',
    );
      //creating the ASG with fixed size by setting MinCapacity and MaxCapcity values to 2
    const asg = new autoscaling.AutoScalingGroup(this, 'asg', {
      vpc,
      //sets the EC2 instances to be t3.nano
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.NANO,
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      userData,
      minCapacity: 2,
      maxCapacity: 2,
    });

    listener.addTargets('default-target', {
      port: 80,
      targets: [asg],
      healthCheck: {
        path: '/',
        unhealthyThresholdCount: 2,
        healthyThresholdCount: 5,
        interval: cdk.Duration.seconds(30),
      },
    });

    listener.addAction('/static', {
      priority: 5,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/static'])],
      action: elbv2.ListenerAction.fixedResponse(200, {
        contentType: 'text/html',
        messageBody: '<h1>Static ALB Response</h1>',
      }),
    });
    //gets the DNS value of our app (directly to the ALB)
    new cdk.CfnOutput(this, 'albDNS', {
      value: alb.loadBalancerDnsName,
    });
  }
}


