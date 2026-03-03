# Turing DevOps (Pulumi + TypeScript) - Complete Interview Guide

> **📌 Purpose**: Everything you need to get and pass the Turing DevOps interview. Based on actual job requirements from TURING_JOB_DESCRIPTION.md.

## 🎯 Phase 1: Getting the Interview

### Resume Keywords (Use Exactly)
- **Pulumi TypeScript SDK** (not just "Pulumi" or "TypeScript")
- **Infrastructure as Code (IaC)**
- **Reusable TypeScript abstractions**
- **Pulumi CLI commands** (pulumi up, preview, destroy)
- **Stack state management**
- **Stack outputs integration** 
- **Jest/Mocha testing**
- **CI/CD pipeline integration**

### Power Resume Bullets (Copy-Paste Ready)
```
• Designed scalable cloud infrastructure using Pulumi's TypeScript SDK, managing 200+ AWS resources
• Created reusable TypeScript abstractions reducing deployment time by 85% (2 hours to 18 minutes)
• Managed Pulumi stack states across dev/staging/prod with automated backup strategies
• Developed Jest-based unit tests for infrastructure code, achieving 95% test coverage
• Integrated Pulumi workflows into CI/CD pipelines using GitHub Actions v5
```

### Cover Letter Template
```
Dear Turing Team,

As a Cloud Infrastructure Engineer with expertise in Pulumi's TypeScript SDK, I've achieved:
- 85% reduction in deployment times through reusable TypeScript components
- 35% cost optimization ($17.5K/month) via efficient stack management  
- 200+ AWS resources managed across multiple environments

My experience aligns perfectly with your requirements for scalable, reusable infrastructure components.

[Your Name]
```

## 🏃 Phase 2: Interview Process

### Stage 1: Technical Assessment (45-120 min)
Focus on practical Pulumi implementation:

```typescript
// Practice this pattern
export class WebApp extends pulumi.ComponentResource {
    public readonly url: pulumi.Output<string>;
    
    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super("custom:app:WebApp", name, {}, opts);
        
        const bucket = new aws.s3.Bucket(`${name}-static`, {
            website: { indexDocument: "index.html" }
        }, { parent: this });
        
        this.url = bucket.websiteEndpoint;
        this.registerOutputs({ url: this.url }); // CRITICAL!
    }
}
```

### Stage 2: Technical Interview
Based on job requirements, expect questions on:

1. **Pulumi CLI Commands**
```bash
pulumi up --yes                 # Deploy changes
pulumi preview --diff           # Show planned changes  
pulumi destroy --yes            # Tear down resources
pulumi stack export             # Export state
pulumi state delete <urn>       # Remove from state
```

2. **TypeScript Abstractions**
```typescript
// Reusable component pattern
interface WebServiceArgs {
    domain: string;
    environment: string;
}

export class WebService extends pulumi.ComponentResource {
    public readonly endpoint: pulumi.Output<string>;
    
    constructor(name: string, args: WebServiceArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:webservice", name, {}, opts);
        
        // Create resources with { parent: this }
        const bucket = new aws.s3.Bucket(`${name}-bucket`, {}, { parent: this });
        
        this.endpoint = pulumi.interpolate`https://${args.domain}`;
        this.registerOutputs({ endpoint: this.endpoint });
    }
}
```

3. **Stack State Management**
```typescript
// Stack outputs for integration
export const apiUrl = api.url;
export const databaseConnectionString = db.connectionString;

// Cross-stack references
const sharedStack = new pulumi.StackReference("shared-infra");
const vpcId = sharedStack.getOutput("vpcId");
```

4. **Testing Infrastructure Code**
```typescript
import * as testing from "@pulumi/pulumi/testing";

describe("WebService", () => {
    it("should create S3 bucket", async () => {
        const resources = await testing.runPulumiProgram(() => {
            new WebService("test", { 
                domain: "example.com",
                environment: "test"
            });
        });
        
        const bucket = resources.find(r => r.type === "aws:s3:Bucket");
        expect(bucket).toBeDefined();
    });
});
```

### Stage 3: Debugging Skills
Show ability to troubleshoot deployments:

```typescript
// Debug failed deployment
pulumi up --debug --logtostderr -v=9

// Common issues and solutions:
// 1. Missing parent relationship
const subnet = new aws.ec2.Subnet("subnet", {
    vpcId: vpc.id
}, { parent: this }); // Add parent!

// 2. Circular dependencies - use apply()
const dbUrl = pulumi.all([db.endpoint, db.port])
    .apply(([endpoint, port]) => `postgres://user@${endpoint}:${port}/db`);

// 3. State corruption - refresh and fix
pulumi refresh --diff
pulumi state delete <problematic-urn>
```

## 💡 Key Talking Points

### Your Impact Metrics
- **85%** faster deployments (2hr → 18min)
- **35%** cost reduction ($17.5K/month) 
- **200+** resources managed
- **95%** test coverage
- **Zero** manual deployments

### Why Pulumi + TypeScript
"I chose Pulumi with TypeScript because it provides type safety, better IDE support, and allows me to apply software engineering best practices like testing, code reuse, and modular design to infrastructure. This has reduced our deployment errors by 90% and enabled true Infrastructure as Code."

### Cross-functional Collaboration
"I work closely with development teams to understand their infrastructure needs and translate requirements into reusable Pulumi components. I've created a library of TypeScript abstractions that developers can use self-service, reducing infrastructure tickets by 70%."

## 🔧 Essential Code Patterns

### 1. Input/Output Handling (CRITICAL)
```typescript
// ✅ CORRECT - Always use .apply()
bucket.id.apply(id => {
    console.log(`Bucket created: ${id}`);
});

// ❌ WRONG - Will fail!
console.log(bucket.id.toString());

// Combining outputs
const url = pulumi.interpolate`https://${bucket.websiteDomain}/app`;
```

### 2. Component Best Practices
```typescript
export class DatabaseCluster extends pulumi.ComponentResource {
    public readonly connectionString: pulumi.Output<string>;
    
    constructor(name: string, args: DatabaseArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:database", name, {}, opts);
        
        // Create resources
        const cluster = new aws.rds.Cluster(`${name}-cluster`, {
            engine: "aurora-postgresql",
            masterUsername: args.username,
            masterPassword: args.password,
            backupRetentionPeriod: 7,
            deletionProtection: args.environment === "prod"
        }, { parent: this });
        
        this.connectionString = pulumi.interpolate`postgresql://${cluster.endpoint}:5432/${cluster.databaseName}`;
        
        // MUST include this!
        this.registerOutputs({
            connectionString: this.connectionString
        });
    }
}
```

### 3. CI/CD Integration
```yaml
# GitHub Actions workflow
- name: Deploy Infrastructure
  uses: pulumi/actions@v5
  with:
    command: up
    stack-name: production
  env:
    PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

## ✅ Interview Day Checklist

- [ ] Review job requirements in TURING_JOB_DESCRIPTION.md
- [ ] Practice Input/Output patterns
- [ ] Know your impact metrics (85%, 35%, 200+)
- [ ] Prepare reusable component examples
- [ ] Test your development environment
- [ ] Prepare questions about their infrastructure scale

## 🏢 How Turing Compares to FAANG Companies

### Google SRE (Difficulty: 8/10)
**Interview Structure:**
- Recruiter screen: 15 Linux/networking questions
- Phone screen: 45 minutes Linux + coding  
- On-site: NALSD, Googleyness, Troubleshooting, Linux, Coding

**Sample Questions:**
- "Explain virtual memory translation and why it's implemented this way"
- "Design globally distributed object storage system. Calculate exact machine requirements."
- "How would you implement SLO monitoring using Pulumi?"

### Meta Production Engineer (Difficulty: 7/10)
**Focus Areas:**
- Network protocols (TCP/IP stack deep knowledge)
- Infrastructure design with fault tolerance
- Real production troubleshooting

**Example Questions:**
- "What happens when you type facebook.com?" (30-minute deep dive)
- "Design a job scheduler with Pulumi" (focus on concurrency)
- "Database is slow - debug using Pulumi-managed infrastructure"

### Amazon DevOps (Difficulty: 6/10)
**Key Characteristics:**
- CloudFormation vs Pulumi comparison required
- AWS service integration depth
- Cost optimization focus
- Leadership Principles integration in every answer

**Sample Questions:**
- "Migrate CloudFormation to Pulumi - what's your approach?"
- "Design infrastructure for Prime Day traffic using Pulumi"
- "Implement FinOps practices in Pulumi deployments"

### **Turing Advantage (Difficulty: 5/10)**
- Focus on practical Pulumi implementation
- Less algorithmic complexity than FAANG
- More emphasis on collaboration and TypeScript abstractions
- Realistic timelines and expectations

## 🎭 Behavioral Questions (STAR Framework)

### Production Incident Response
**Situation:** "Last year, we experienced a cascading failure across our microservices platform affecting 50K users"

**Task:** "I led the incident response, first establishing a command center and clear communication channels"

**Action:** "Using our Pulumi-managed observability stack, I traced the issue to a misconfigured service mesh retry policy causing thundering herd. We implemented circuit breakers using Pulumi policy-as-code"

**Result:** "Restored service in 23 minutes, preventing future occurrences. Post-incident, I automated similar configuration checks in our CI/CD pipeline"

### Additional Behavioral Scenarios
1. **Most challenging production incident** - Focus on Pulumi state recovery
2. **Convincing developers to adopt DevOps practices** - Emphasize TypeScript abstractions
3. **Controversial technical decision** - Migration from CloudFormation to Pulumi
4. **Cross-team collaboration** - Building shared infrastructure components

## 🎤 Questions to Ask Turing

1. "How do you currently manage Pulumi state across your development teams?"
2. "What's your approach to creating reusable infrastructure components?"
3. "How do you handle testing of infrastructure code in your CI/CD pipeline?"
4. "What's the typical complexity of the TypeScript abstractions you build?"

## 🚨 Common Gotchas (Avoid These!)

1. **Missing registerOutputs()** in ComponentResource
2. **Using .toString()** on Output types instead of .apply()
3. **Forgetting parent relationships** in components
4. **Not using exact keywords** from job description
5. **Talking about advanced features** not in job requirements

## 🎯 Success Tips

1. **Stick to job requirements** - Don't over-engineer answers
2. **Show practical experience** with the exact stack they want
3. **Quantify everything** - Use specific numbers and metrics  
4. **Demonstrate collaboration** skills with cross-functional teams
5. **Ask clarifying questions** before diving into code

Remember: Turing's job focuses on **scalable, reusable infrastructure components** using **Pulumi TypeScript SDK**. Keep all answers aligned with these core requirements!

## 🏭 System Design for FAANG-Level Infrastructure

### Design: Multi-Region Video Streaming Infrastructure (Netflix-Scale)

**Requirements:**
- 200M+ users globally
- 15TB/s peak bandwidth
- <100ms latency worldwide
- 99.99% availability

**Pulumi Implementation:**
```typescript
export class GlobalStreamingPlatform extends pulumi.ComponentResource {
    constructor(name: string, args: StreamingPlatformArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:GlobalStreamingPlatform", name, {}, opts);
        
        // Global edge locations
        const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1', 'sa-east-1'];
        const edgeLocations: EdgeLocation[] = [];
        
        // Deploy to each region
        for (const region of regions) {
            const edge = this.deployEdgeLocation(region);
            edgeLocations.push(edge);
        }
        
        // Global CDN with Origin Shield
        const cdn = new aws.cloudfront.Distribution(`${name}-global-cdn`, {
            origins: [{
                domainName: args.originBucket.websiteDomain,
                originId: "S3-origin",
                originShield: {
                    enabled: true,
                    originShieldRegion: "us-east-1"
                }
            }],
            defaultCacheBehavior: {
                targetOriginId: "S3-origin",
                viewerProtocolPolicy: "redirect-to-https",
                compress: true,
                cachePolicyId: this.createStreamingCachePolicy(),
                originRequestPolicyId: this.createOriginRequestPolicy()
            },
            priceClass: "PriceClass_All", // All edge locations
            httpVersion: "http2and3", // HTTP/3 for lower latency
            isIpv6Enabled: true
        });
        
        // Multi-tier caching architecture
        const cacheArchitecture = this.setupCachingTiers(edgeLocations);
        
        this.registerOutputs({
            cdnDomain: cdn.domainName,
            edgeCount: edgeLocations.length,
            estimatedGlobalLatency: "<100ms"
        });
    }
    
    private deployEdgeLocation(region: string): EdgeLocation {
        // Regional compute for edge processing
        const cluster = new aws.ecs.Cluster(`edge-${region}`, {
            capacityProviders: ["FARGATE_SPOT", "FARGATE"],
            defaultCapacityProviderStrategy: [{
                capacityProvider: "FARGATE_SPOT",
                weight: 80,
                base: 0
            }, {
                capacityProvider: "FARGATE",
                weight: 20,
                base: 20 // Always have 20 FARGATE tasks
            }]
        });
        
        // Adaptive bitrate streaming service
        const streamingService = new aws.ecs.Service(`stream-${region}`, {
            cluster: cluster.arn,
            taskDefinition: this.createStreamingTaskDef(region),
            desiredCount: 100, // Start with 100 tasks
            deploymentConfiguration: {
                maximumPercent: 200,
                minimumHealthyPercent: 100,
                deploymentCircuitBreaker: {
                    enable: true,
                    rollback: true
                }
            }
        });
        
        // Auto-scaling based on concurrent viewers
        const scaling = new aws.appautoscaling.Target(`scale-${region}`, {
            serviceNamespace: "ecs",
            resourceId: pulumi.interpolate`service/${cluster.name}/${streamingService.name}`,
            scalableDimension: "ecs:service:DesiredCount",
            minCapacity: 50,
            maxCapacity: 5000 // Scale up to 5000 tasks
        });
        
        new aws.appautoscaling.Policy(`scale-policy-${region}`, {
            policyType: "TargetTrackingScaling",
            resourceId: scaling.resourceId,
            scalableDimension: scaling.scalableDimension,
            targetTrackingScalingPolicyConfiguration: {
                targetValue: 1000, // 1000 concurrent streams per task
                predefinedMetricSpecification: {
                    predefinedMetricType: "ECSServiceAverageCPUUtilization"
                },
                scaleInCooldown: 60,
                scaleOutCooldown: 30 // Fast scale-out for live events
            }
        });
        
        return { region, cluster, service: streamingService };
    }
}

// Interview Discussion Points:
// 1. How would you handle 10M concurrent viewers for a live event?
// 2. Implement geographic failover with <30s RTO
// 3. Design cost optimization for off-peak hours
// 4. How to ensure GDPR compliance in EU regions?
```

### Design: Global Financial Transaction System (Stripe-Scale)

**Requirements:**
- 1M+ transactions/second
- <50ms p99 latency
- Zero data loss
- PCI-DSS compliance

```typescript
export class FinancialTransactionPlatform extends pulumi.ComponentResource {
    constructor(name: string, args: FinTechArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:FinancialPlatform", name, {}, opts);
        
        // Multi-region active-active architecture
        const primaryRegion = this.deployPrimaryRegion(args);
        const secondaryRegion = this.deploySecondaryRegion(args);
        
        // Global transaction router with smart routing
        const transactionRouter = new TransactionRouter("router", {
            primaryEndpoint: primaryRegion.endpoint,
            secondaryEndpoint: secondaryRegion.endpoint,
            routingStrategy: "latency-based",
            healthCheckInterval: 5 // 5 second health checks
        });
        
        // Implement SAGA pattern for distributed transactions
        const sagaOrchestrator = new SagaOrchestrator("saga", {
            steps: [
                { name: "validate", compensate: "reverseValidation" },
                { name: "reserve", compensate: "releaseReservation" },
                { name: "charge", compensate: "refund" },
                { name: "settle", compensate: "reverseSettlement" }
            ],
            timeout: 30000 // 30 second timeout
        });
        
        // PCI-DSS compliant data handling
        const encryptionKey = new aws.kms.Key(`${name}-encryption`, {
            description: "PCI-DSS compliant encryption key",
            keyUsage: "ENCRYPT_DECRYPT",
            customerMasterKeySpec: "RSA_4096",
            multiRegion: true
        });
        
        // Fraud detection ML pipeline
        const fraudDetection = this.setupFraudDetection(transactionRouter);
        
        this.registerOutputs({
            transactionCapacity: "1M+ TPS",
            p99Latency: "<50ms",
            complianceLevel: "PCI-DSS Level 1"
        });
    }
}

// Discussion: How would you handle regulatory compliance across 50+ countries?
```

### Advanced Interview Topics

**1. Distributed Systems Challenges:**
- CAP theorem trade-offs in Pulumi deployments
- Handling split-brain scenarios in multi-region setups
- Eventual consistency vs strong consistency

**2. Performance at Scale:**
- Optimizing Pulumi for 50,000+ resource deployments
- Memory management for large state files
- Parallel execution strategies

**3. Security & Compliance:**
- Zero-trust architecture implementation
- Secrets rotation without downtime
- Audit logging for compliance

**4. Cost Optimization:**
- FinOps practices with Pulumi
- Spot instance strategies
- Reserved capacity planning

Good luck! 🚀