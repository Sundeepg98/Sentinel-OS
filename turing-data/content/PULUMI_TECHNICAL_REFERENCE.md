# Pulumi TypeScript Technical Reference

> **📌 Purpose**: Comprehensive technical reference covering fundamentals to advanced patterns. Use for non-Turing interviews or deep technical preparation.

## Core Concepts

### 1. Pulumi Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Language      │    │   Deployment     │    │   Resource      │
│   Host          │◄──►│   Engine         │◄──►│   Provider      │
│ (Node.js/TS)    │    │ (pulumi CLI)     │    │ (AWS/Azure/GCP) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   State Backend  │
                       │ (Pulumi Cloud)   │
                       └──────────────────┘
```

**Deployment Process:**
1. **Program Execution**: Language host runs your TypeScript code
2. **Resource Registration**: Resources registered with deployment engine
3. **Planning**: Engine creates execution plan (like `pulumi preview`)
4. **Execution**: Engine coordinates with providers to create/update resources
5. **State Update**: Final state saved to backend

### Pulumi Engine Deep Dive

**DAG (Directed Acyclic Graph) Execution:**
- Resources become vertices in DAG
- Dependencies become edges in graph  
- Engine uses **topological sorting** to determine execution order
- **Default parallelism**: 2147483647 (effectively unlimited)
- Resources with no dependencies execute concurrently
- Circular dependencies detected through in-degree calculations

**Execution Flow:**
```
1. Resource Registration Phase → Resources become DAG vertices
2. Edge Creation → Dependencies become DAG edges  
3. Topological Sort → Determines execution order
4. Parallel Execution → Resources at same level execute concurrently
5. Provider Communication → gRPC calls to resource providers
```

**Performance Characteristics:**
- Engine can handle 15,000+ resources with proper micro-stack architecture
- Memory usage scales with state size (500MB+ states require decomposition)
- Deployment optimization: 45-60 minutes → 5-8 minutes with micro-stacks

### 2. Input/Output Type System

```typescript
// Core types
type Input<T> = T | Promise<T> | Output<T>;
type Output<T> = /* Internal Pulumi type with .apply() method */;

// Always use .apply() for Output values
const bucket = new aws.s3.Bucket("my-bucket");

// ✅ CORRECT
bucket.id.apply(id => {
    console.log(`Bucket ID: ${id}`);
    return id;
});

// ✅ CORRECT - Combining outputs
const url = pulumi.interpolate`https://${bucket.websiteDomain}/api`;

// ✅ CORRECT - Multiple outputs
const dbConnection = pulumi.all([db.endpoint, db.port, db.username])
    .apply(([endpoint, port, username]) => 
        `postgresql://${username}@${endpoint}:${port}/mydb`);

// ❌ WRONG - Will fail at runtime
console.log(bucket.id.toString()); 
const wrongUrl = `https://${bucket.websiteDomain}/api`;
```

### 3. Resources: Custom vs Component

#### Custom Resources (Map 1:1 to cloud resources)
```typescript
// Creates actual AWS S3 bucket
const bucket = new aws.s3.Bucket("my-bucket", {
    versioning: { enabled: true },
    tags: { Environment: "prod" }
});
```

#### Component Resources (Logical grouping)
```typescript
export class WebSite extends pulumi.ComponentResource {
    public readonly url: pulumi.Output<string>;
    public readonly distributionId: pulumi.Output<string>;
    
    constructor(name: string, args: WebSiteArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:WebSite", name, {}, opts);
        
        // S3 bucket for content
        const bucket = new aws.s3.Bucket(`${name}-bucket`, {
            website: {
                indexDocument: "index.html",
                errorDocument: "error.html"
            }
        }, { parent: this }); // IMPORTANT: Set parent
        
        // CloudFront distribution
        const distribution = new aws.cloudfront.Distribution(`${name}-cdn`, {
            origins: [{
                domainName: bucket.bucketDomainName,
                originId: "S3Origin",
                s3OriginConfig: {
                    originAccessIdentity: ""
                }
            }],
            defaultCacheBehavior: {
                targetOriginId: "S3Origin",
                viewerProtocolPolicy: "redirect-to-https",
                compress: true
            },
            enabled: true,
            defaultRootObject: "index.html"
        }, { parent: this });
        
        this.url = distribution.domainName;
        this.distributionId = distribution.id;
        
        // CRITICAL: Must call registerOutputs()
        this.registerOutputs({
            url: this.url,
            distributionId: this.distributionId
        });
    }
}
```

## Stack Management

### Configuration
```typescript
const config = new pulumi.Config();

// Required values
const region = config.require("region");
const environment = config.require("environment");

// Optional with defaults
const instanceType = config.get("instanceType") || "t3.micro";

// Secrets (automatically encrypted)
const dbPassword = config.requireSecret("dbPassword");
const apiKey = config.getSecret("apiKey");
```

### Stack References (Cross-stack dependencies)
```typescript
// In shared-infrastructure stack
export const vpcId = vpc.id;
export const subnetIds = subnets.map(s => s.id);

// In application stack
const sharedInfra = new pulumi.StackReference("org/shared-infrastructure/prod");
const vpcId = sharedInfra.getOutput("vpcId");
const subnetIds = sharedInfra.getOutput("subnetIds");

const instance = new aws.ec2.Instance("app", {
    ami: "ami-12345678",
    instanceType: "t3.micro",
    subnetId: subnetIds.apply(ids => ids[0]), // Use first subnet
    vpcSecurityGroupIds: [securityGroup.id]
});
```

## Testing Infrastructure Code

### Unit Testing with Jest
```typescript
import * as testing from "@pulumi/pulumi/testing";
import * as aws from "@pulumi/aws";

describe("WebSite component", () => {
    let resources: testing.MockResourceMonitor;
    
    beforeEach(() => {
        resources = testing.setMocks({
            newResource: (args: testing.MockResourceArgs): testing.MockResourceResult => {
                return {
                    id: args.name + "_id",
                    state: args.inputs,
                };
            },
            call: (args: testing.MockCallArgs) => args.result
        });
    });
    
    it("creates S3 bucket and CloudFront distribution", async () => {
        const infra = testing.runPulumiProgram(() => {
            return new WebSite("test-site", {
                domain: "example.com"
            });
        });
        
        const resourcesCreated = await infra.resources;
        const bucket = resourcesCreated.find(r => r.type === "aws:s3:Bucket");
        const distribution = resourcesCreated.find(r => r.type === "aws:cloudfront:Distribution");
        
        expect(bucket).toBeDefined();
        expect(distribution).toBeDefined();
        expect(bucket.inputs.website).toBeDefined();
    });
});
```

### Integration Testing
```typescript
import { LocalWorkspace } from "@pulumi/pulumi/automation";

describe("Infrastructure integration", () => {
    it("deploys successfully to test environment", async () => {
        const stack = await LocalWorkspace.createOrSelectStack({
            stackName: "integration-test",
            projectName: "my-project",
            program: async () => {
                const bucket = new aws.s3.Bucket("test-bucket");
                return { bucketName: bucket.id };
            }
        });
        
        await stack.setConfig("aws:region", { value: "us-west-2" });
        
        const upResult = await stack.up();
        expect(upResult.summary.kind).toBe("update");
        expect(upResult.summary.result).toBe("succeeded");
        
        // Cleanup
        await stack.destroy();
    });
});
```

## Pulumi Automation API

### Complete Programmatic Infrastructure Management

The Automation API enables building infrastructure platforms and self-service portals:

```typescript
import { LocalWorkspace, Stack } from "@pulumi/pulumi/automation";

// Infrastructure-as-a-Service Platform
export class InfrastructurePlatform {
    
    // Deploy application infrastructure programmatically
    async deployApplication(config: AppDeploymentConfig): Promise<DeploymentResult> {
        const stackName = `${config.appName}-${config.environment}`;
        
        const stack = await LocalWorkspace.createOrSelectStack({
            stackName,
            projectName: config.projectName,
            program: this.createInfrastructureProgram(config)
        });
        
        // Set configuration
        await stack.setConfig("aws:region", { value: config.region });
        await stack.setConfig("app:replicas", { value: config.replicas.toString() });
        await stack.setConfig("app:instanceType", { value: config.instanceType });
        
        // Deploy with progress tracking
        const upResult = await stack.up({
            onOutput: (output) => {
                console.log(`[${stackName}] ${output}`);
                this.notifyProgress(config.userId, output);
            }
        });
        
        // Get outputs
        const outputs = await stack.outputs();
        
        return {
            stackName,
            status: upResult.summary.result,
            endpoint: outputs.endpoint?.value,
            databaseUrl: outputs.databaseUrl?.value,
            deploymentTime: upResult.summary.endTime - upResult.summary.startTime
        };
    }
    
    // Multi-environment promotion workflow
    async promoteToProduction(appName: string): Promise<void> {
        const stagingStack = await LocalWorkspace.selectStack({
            stackName: `${appName}-staging`,
            projectName: "platform"
        });
        
        // Get staging configuration
        const stagingOutputs = await stagingStack.outputs();
        const stagingConfig = await stagingStack.getAllConfig();
        
        // Create production stack with promoted config
        const prodStack = await LocalWorkspace.createOrSelectStack({
            stackName: `${appName}-production`,
            projectName: "platform",
            program: this.createInfrastructureProgram({
                appName,
                environment: "production",
                imageTag: stagingOutputs.imageTag?.value
            })
        });
        
        // Apply production-specific overrides
        await prodStack.setConfig("app:replicas", { value: "3" });
        await prodStack.setConfig("app:instanceType", { value: "m5.large" });
        await prodStack.setConfig("app:enableBackups", { value: "true" });
        
        // Deploy to production
        await prodStack.up();
        
        console.log(`Successfully promoted ${appName} to production`);
    }
    
    // Disaster recovery automation
    async performFailover(primaryRegion: string, backupRegion: string): Promise<void> {
        const backupStack = await LocalWorkspace.selectStack({
            stackName: `app-${backupRegion}`,
            projectName: "disaster-recovery"
        });
        
        // Update DNS to point to backup region
        await backupStack.setConfig("dns:primaryRegion", { value: backupRegion });
        await backupStack.setConfig("rds:readOnly", { value: "false" });
        
        const result = await backupStack.up();
        
        if (result.summary.result === "succeeded") {
            await this.notifyTeam(`Failover to ${backupRegion} completed successfully`);
        }
    }
    
    // Infrastructure cost optimization
    async optimizeCosts(): Promise<CostOptimizationReport> {
        const stacks = await LocalWorkspace.listStacks();
        const report: CostOptimizationReport = {
            totalSavings: 0,
            optimizations: []
        };
        
        for (const stackSummary of stacks) {
            const stack = await LocalWorkspace.selectStack({
                stackName: stackSummary.name,
                projectName: "platform"
            });
            
            const config = await stack.getAllConfig();
            const environment = config["app:environment"]?.value;
            
            // Optimize non-production environments
            if (environment !== "production") {
                const currentInstanceType = config["app:instanceType"]?.value;
                if (currentInstanceType === "m5.large") {
                    await stack.setConfig("app:instanceType", { value: "t3.medium" });
                    report.optimizations.push({
                        stack: stackSummary.name,
                        change: "Downgraded instance type",
                        savings: "$200/month"
                    });
                    report.totalSavings += 200;
                }
            }
            
            // Deploy optimizations
            await stack.up();
        }
        
        return report;
    }
    
    private createInfrastructureProgram(config: AppDeploymentConfig) {
        return async () => {
            // Create VPC
            const vpc = new aws.ec2.Vpc(`${config.appName}-vpc`, {
                cidrBlock: "10.0.0.0/16",
                enableDnsHostnames: true
            });
            
            // Create application load balancer
            const alb = new aws.lb.LoadBalancer(`${config.appName}-alb`, {
                loadBalancerType: "application",
                subnets: config.subnetIds
            });
            
            // Create ECS cluster and service
            const cluster = new aws.ecs.Cluster(`${config.appName}-cluster`);
            const service = new aws.ecs.Service(`${config.appName}-service`, {
                cluster: cluster.arn,
                taskDefinition: this.createTaskDefinition(config),
                desiredCount: config.replicas,
                loadBalancers: [{
                    targetGroupArn: targetGroup.arn,
                    containerName: config.appName,
                    containerPort: 8080
                }]
            });
            
            // Return stack outputs
            return {
                endpoint: alb.dnsName,
                clusterName: cluster.name,
                serviceName: service.name
            };
        };
    }
}

// Usage examples
const platform = new InfrastructurePlatform();

// Deploy new application
await platform.deployApplication({
    appName: "user-service",
    environment: "staging", 
    region: "us-west-2",
    replicas: 2,
    instanceType: "t3.medium"
});

// Promote to production
await platform.promoteToProduction("user-service");

// Automated cost optimization
const savings = await platform.optimizeCosts();
console.log(`Total monthly savings: $${savings.totalSavings}`);
```

## CI/CD Integration

### GitHub Actions (v5)
```yaml
name: Infrastructure Deploy
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
        
      - name: Pulumi Preview
        uses: pulumi/actions@v5
        with:
          command: preview
          stack-name: staging
        env:
          PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
          
  deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Deploy to Production
        uses: pulumi/actions@v5
        with:
          command: up
          stack-name: production
        env:
          PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

### GitLab CI
```yaml
stages:
  - validate
  - deploy

variables:
  PULUMI_ACCESS_TOKEN: $PULUMI_ACCESS_TOKEN

before_script:
  - curl -fsSL https://get.pulumi.com | sh
  - export PATH=$PATH:$HOME/.pulumi/bin
  - npm install

validate:
  stage: validate
  script:
    - pulumi preview --stack staging
  only:
    - merge_requests

deploy:
  stage: deploy
  script:
    - pulumi up --yes --stack production
  only:
    - main
```

## State Management

### Backends
```typescript
// Pulumi Cloud (default)
// No configuration needed

// Self-managed S3 backend
pulumi login s3://my-pulumi-state-bucket

// Azure Blob Storage
pulumi login azblob://mystorageaccount/mycontainer

// Local filesystem (development only)
pulumi login file://./state
```

### State Operations
```bash
# Export state for backup
pulumi stack export > state-backup.json

# Import state from backup
pulumi stack import < state-backup.json

# Remove resource from state (without deleting)
pulumi state delete 'urn:pulumi:dev::myproject::aws:s3/bucket:Bucket::mybucket'

# Refresh state from actual resources
pulumi refresh

# Import existing resource into state
pulumi import aws:s3/bucket:Bucket mybucket existing-bucket-name
```

### Advanced State Surgery and Recovery

Production environments require sophisticated state management capabilities:

```typescript
export interface StateIssue {
  type: 'corruption' | 'cycle' | 'orphan';
  urn: string;
  description: string;
}

export class StateRecoveryManager {
  constructor(private stackName: string) {}
  
  async diagnoseProblem(): Promise<StateIssue[]> {
    const state = await this.exportState();
    const issues: StateIssue[] = [];
    
    // Check for corrupted resources
    for (const resource of state.deployment.resources) {
      if (this.isResourceCorrupted(resource)) {
        issues.push({
          type: 'corruption',
          urn: resource.urn,
          description: `Resource ${resource.urn} has invalid state`
        });
      }
    }
    
    // Check for dependency cycles
    const cycles = this.findDependencyCycles(state.deployment.resources);
    issues.push(...cycles.map(cycle => ({
      type: 'cycle',
      urn: cycle.join(' -> '),
      description: `Dependency cycle detected: ${cycle.join(' -> ')}`
    })));
    
    return issues;
  }
  
  async repairCorruptedResource(urn: string): Promise<void> {
    try {
      // Step 1: Remove from state
      await this.deleteFromState(urn);
      
      // Step 2: Re-import from actual resource
      const resourceId = await this.discoverActualResourceId(urn);
      if (resourceId) {
        await this.importResource(urn, resourceId);
      }
      
    } catch (error) {
      throw new Error(`Failed to repair ${urn}: ${error.message}`);
    }
  }
  
  private async exportState(): Promise<any> {
    return JSON.parse(await this.runCommand('pulumi stack export'));
  }
  
  private async deleteFromState(urn: string): Promise<void> {
    await this.runCommand(`pulumi state delete '${urn}'`);
  }
  
  private async importResource(urn: string, resourceId: string): Promise<void> {
    const resourceType = this.extractResourceType(urn);
    await this.runCommand(`pulumi import ${resourceType} ${resourceId}`);
  }
  
  private isResourceCorrupted(resource: any): boolean {
    // Check for invalid state conditions
    return !resource.id || !resource.type || resource.outputs === null;
  }
  
  private findDependencyCycles(resources: any[]): string[][] {
    // Implementation of cycle detection algorithm
    const visited = new Set();
    const recursionStack = new Set();
    const cycles: string[][] = [];
    
    for (const resource of resources) {
      if (!visited.has(resource.urn)) {
        this.detectCycleDFS(resource, resources, visited, recursionStack, cycles);
      }
    }
    
    return cycles;
  }
}

// Usage for production incidents
const recovery = new StateRecoveryManager("production");
const issues = await recovery.diagnoseProblem();

for (const issue of issues) {
  if (issue.type === 'corruption') {
    await recovery.repairCorruptedResource(issue.urn);
  }
}
```

## Debugging and Troubleshooting

### Debug Commands
```bash
# Verbose logging
pulumi up --logtostderr -v=9

# Show detailed diff
pulumi preview --diff

# Debug mode
pulumi up --debug

# Show only changes
pulumi up --show-config --show-replacement-steps
```

### Common Issues and Solutions

1. **Circular Dependencies**
```typescript
// ❌ Problem: Circular reference
const rolePolicy = new aws.iam.RolePolicy("policy", {
    role: role.id,
    policy: JSON.stringify({
        Statement: [{
            Effect: "Allow",
            Action: "s3:GetObject",
            Resource: bucket.arn.apply(arn => `${arn}/*`)  // Depends on bucket
        }]
    })
});

const role = new aws.iam.Role("role", {
    assumeRolePolicy: rolePolicy.policy  // Depends on policy - CIRCULAR!
});

// ✅ Solution: Break the circle
const role = new aws.iam.Role("role", {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: { Service: "ec2.amazonaws.com" },
            Action: "sts:AssumeRole"
        }]
    })
});

const rolePolicy = new aws.iam.RolePolicy("policy", {
    role: role.id,
    policy: bucket.arn.apply(arn => JSON.stringify({
        Statement: [{
            Effect: "Allow", 
            Action: "s3:GetObject",
            Resource: `${arn}/*`
        }]
    }))
});
```

2. **Missing Parent Relationships**
```typescript
// ❌ Problem: No parent set
export class DatabaseCluster extends pulumi.ComponentResource {
    constructor(name: string) {
        super("custom:DatabaseCluster", name);
        
        const subnet = new aws.ec2.Subnet("subnet", {
            vpcId: vpc.id
            // Missing parent!
        });
    }
}

// ✅ Solution: Always set parent
const subnet = new aws.ec2.Subnet("subnet", {
    vpcId: vpc.id
}, { parent: this });
```

3. **State Corruption Recovery**
```bash
# Step 1: Export current state
pulumi stack export > corrupted-state.json

# Step 2: Identify problematic resources
pulumi refresh --diff

# Step 3: Remove corrupted resources from state
pulumi state delete 'urn:pulumi:...:problematic-resource'

# Step 4: Re-import if needed
pulumi import aws:s3/bucket:Bucket mybucket actual-bucket-name

# Step 5: Verify everything is clean
pulumi preview --expect-no-changes
```

## Performance Optimization

### For Large Deployments (500+ resources)
```typescript
// Use --parallel flag
pulumi up --parallel 10

// Break into smaller stacks
const coreInfra = new CoreInfrastructure("core");
const appStack1 = new ApplicationStack("app1", { vpcId: coreInfra.vpcId });
const appStack2 = new ApplicationStack("app2", { vpcId: coreInfra.vpcId });

// Use explicit resource options
const bucket = new aws.s3.Bucket("bucket", {}, {
    protect: true,  // Prevent accidental deletion
    ignoreChanges: ["tags"],  // Ignore tag changes
    replaceOnChanges: ["region"]  // Force replacement on region change
});
```

## Latest Features (2025)

### Pulumi ESC (Environments, Secrets, and Configuration)
```yaml
# environment.yaml
values:
  database:
    host: my-db-host.com
    port: 5432
  aws:
    region: us-west-2
    
imports:
  - shared-config

secrets:
  database:
    password:
      fn::secret: "my-secret-value"
```

```typescript
// Use in Pulumi program
const env = new pulumi.Config("env");
const dbHost = env.require("database:host");
const dbPassword = env.requireSecret("database:password");
```

### Pulumi Copilot (AI Assistant)
```bash
# Natural language queries
pulumi copilot "show me all S3 buckets in production"
pulumi copilot "what resources depend on this VPC?"
pulumi copilot "generate code for a load-balanced web app"
```

## Blue-Green Deployments

### Implementation Pattern
```typescript
export class BlueGreenDeployment extends pulumi.ComponentResource {
    public readonly activeEndpoint: pulumi.Output<string>;
    public readonly standbyEndpoint: pulumi.Output<string>;
    
    constructor(name: string, args: DeploymentArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:BlueGreenDeployment", name, {}, opts);
        
        // Blue environment (current)
        const blueCluster = new aws.ecs.Cluster(`${name}-blue`);
        const blueService = new aws.ecs.Service(`${name}-blue-service`, {
            cluster: blueCluster.arn,
            taskDefinition: this.createTaskDefinition("blue", args.imageTag),
            desiredCount: args.desiredCount
        });
        
        // Green environment (new)
        const greenCluster = new aws.ecs.Cluster(`${name}-green`);
        const greenService = new aws.ecs.Service(`${name}-green-service`, {
            cluster: greenCluster.arn,
            taskDefinition: this.createTaskDefinition("green", args.newImageTag),
            desiredCount: 0  // Start with 0, scale up during deployment
        });
        
        // Load balancer for traffic switching
        const alb = new aws.lb.LoadBalancer(`${name}-alb`, {
            loadBalancerType: "application",
            subnets: args.subnetIds
        });
        
        this.activeEndpoint = alb.dnsName;
        this.registerOutputs({ activeEndpoint: this.activeEndpoint });
    }
}

// Deployment automation
export async function performBlueGreenSwitch(stackName: string) {
    const stack = await LocalWorkspace.selectStack({
        stackName,
        projectName: "blue-green-app"
    });
    
    // Scale up green environment
    await stack.setConfig("green:desiredCount", { value: "3" });
    await stack.up();
    
    // Health check green environment
    const healthCheck = await validateGreenEnvironment();
    if (healthCheck.healthy) {
        // Switch traffic to green
        await updateLoadBalancerTargets("green");
        
        // Scale down blue environment
        await stack.setConfig("blue:desiredCount", { value: "0" });
        await stack.up();
    }
}
```

## Kubernetes Deployments

### Basic Application Deployment
```typescript
import * as k8s from "@pulumi/kubernetes";

export class KubernetesApp extends pulumi.ComponentResource {
    public readonly service: k8s.core.v1.Service;
    public readonly deployment: k8s.apps.v1.Deployment;
    
    constructor(name: string, args: K8sArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:KubernetesApp", name, {}, opts);
        
        // Deployment
        this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
            metadata: { name: `${name}-app` },
            spec: {
                replicas: args.replicas || 3,
                selector: { matchLabels: { app: name } },
                template: {
                    metadata: { labels: { app: name } },
                    spec: {
                        containers: [{
                            name: name,
                            image: args.image,
                            ports: [{ containerPort: args.port || 8080 }],
                            resources: {
                                requests: { cpu: "100m", memory: "128Mi" },
                                limits: { cpu: "500m", memory: "512Mi" }
                            },
                            livenessProbe: {
                                httpGet: { path: "/health", port: args.port || 8080 },
                                initialDelaySeconds: 30
                            }
                        }]
                    }
                }
            }
        }, { parent: this });
        
        // Service
        this.service = new k8s.core.v1.Service(`${name}-service`, {
            metadata: { name: `${name}-service` },
            spec: {
                selector: { app: name },
                ports: [{ port: 80, targetPort: args.port || 8080 }],
                type: "LoadBalancer"
            }
        }, { parent: this });
        
        this.registerOutputs({
            serviceName: this.service.metadata.name,
            deploymentName: this.deployment.metadata.name
        });
    }
}
```

## Cost Optimization Patterns

### Resource Right-Sizing
```typescript
export class CostOptimizedInfrastructure extends pulumi.ComponentResource {
    constructor(name: string, args: CostOptimizationArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:CostOptimizedInfra", name, {}, opts);
        
        // Environment-based instance sizing
        const instanceType = this.getInstanceTypeForEnvironment(args.environment);
        
        // Spot instances for non-production
        const spotConfig = args.environment !== "prod" ? {
            spotPrice: "0.10",
            spotInstanceInterruptionBehavior: "terminate"
        } : undefined;
        
        // Auto-scaling with scheduled scaling
        const autoScalingGroup = new aws.autoscaling.Group(`${name}-asg`, {
            minSize: args.environment === "prod" ? 2 : 1,
            maxSize: args.environment === "prod" ? 10 : 3,
            desiredCapacity: args.environment === "prod" ? 3 : 1,
            launchTemplate: {
                id: this.createLaunchTemplate(instanceType, spotConfig).id,
                version: "$Latest"
            },
            tags: [
                { key: "Environment", value: args.environment, propagateAtLaunch: true },
                { key: "Project", value: name, propagateAtLaunch: true },
                { key: "CostCenter", value: args.costCenter, propagateAtLaunch: true }
            ]
        });
        
        // Scheduled scaling for predictable workloads
        if (args.environment === "dev") {
            // Scale down dev environments at night
            new aws.autoscaling.Schedule(`${name}-scale-down`, {
                scheduledActionName: "scale-down-night",
                autoScalingGroupName: autoScalingGroup.name,
                recurrence: "0 22 * * MON-FRI",  // 10 PM weekdays
                desiredCapacity: 0
            });
            
            new aws.autoscaling.Schedule(`${name}-scale-up`, {
                scheduledActionName: "scale-up-morning", 
                autoScalingGroupName: autoScalingGroup.name,
                recurrence: "0 8 * * MON-FRI",   // 8 AM weekdays
                desiredCapacity: 1
            });
        }
    }
    
    private getInstanceTypeForEnvironment(env: string): string {
        switch (env) {
            case "prod": return "m5.large";
            case "staging": return "t3.medium";
            case "dev": return "t3.micro";
            default: return "t3.micro";
        }
    }
}
```

This technical reference covers the essential knowledge needed for Pulumi TypeScript interviews at most companies. Focus on the patterns and concepts most relevant to your target role.