# Pulumi Quick Reference & Cheat Sheet

> **📌 Purpose**: Last-minute review, interview day reference, essential commands and gotchas.

## 🎯 Essential Commands

### Stack Management
```bash
# Create and switch stacks
pulumi stack init dev
pulumi stack select prod
pulumi stack ls

# Configuration
pulumi config set aws:region us-west-2
pulumi config set --secret dbPassword mySecret123
pulumi config get aws:region

# Deployment
pulumi up --yes                    # Deploy with auto-approve
pulumi preview --diff              # Show detailed changes
pulumi destroy --yes               # Delete all resources
```

### State Operations
```bash
# State management
pulumi refresh                     # Sync state with cloud
pulumi state delete <urn>          # Remove from state only
pulumi stack export > backup.json  # Backup state
pulumi import aws:s3/bucket:Bucket mybucket existing-name

# Debugging
pulumi up --debug --logtostderr -v=9
pulumi logs -f                     # Stream logs
```

## ⚡ Core Patterns (Memorize These!)

### Input/Output Handling
```typescript
// ✅ CORRECT - Always use .apply()
bucket.id.apply(id => console.log(`Bucket: ${id}`));
const url = pulumi.interpolate`https://${bucket.websiteDomain}/api`;

// Combining multiple outputs
const dbUrl = pulumi.all([db.endpoint, db.port])
    .apply(([endpoint, port]) => `postgres://user@${endpoint}:${port}/db`);

// ❌ WRONG - Will fail at runtime!
console.log(bucket.id.toString());
const wrongUrl = `https://${bucket.websiteDomain}/api`;
```

### Component Pattern
```typescript
export class WebService extends pulumi.ComponentResource {
    public readonly url: pulumi.Output<string>;
    
    constructor(name: string, args: WebServiceArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:WebService", name, {}, opts);
        
        // Create resources with { parent: this }
        const bucket = new aws.s3.Bucket(`${name}-bucket`, {}, { parent: this });
        
        this.url = bucket.websiteEndpoint;
        
        // CRITICAL: Must call this!
        this.registerOutputs({ url: this.url });
    }
}
```

## 🚨 Common Gotchas (Avoid These!)

| Issue | Problem | Solution |
|-------|---------|----------|
| **Missing registerOutputs()** | Component outputs undefined | Always call `registerOutputs()` |
| **Using .toString()** | Runtime failure on Outputs | Use `.apply()` instead |
| **No parent relationship** | Resources not properly grouped | Add `{ parent: this }` |
| **Circular dependencies** | Deployment fails | Break the circle with intermediate resources |
| **Wrong CloudFormation limit** | Saying 200 or 1000 | Correct limit is **500** resources (changed Oct 2020) |
| **Old GitHub Actions version** | Using outdated v4 | Use **v5** (current stable version as of 2025) |
| **Cross-language timeline** | Saying "coming in 2025" | **Available since Pulumi 3.0 (2021)** |
| **Terraform licensing** | BSL not mentioned | **Terraform moved to BSL August 2023** |

## 💡 Latest 2025 Features

### Pulumi ESC (Environments, Secrets, Config)
```yaml
# environment.yaml
values:
  database:
    host: mydb.company.com
    port: 5432
imports:
  - shared-config
secrets:
  apiKey:
    fn::secret: "secret-value"
```

### Pulumi Copilot (AI)
```bash
pulumi copilot "show me all S3 buckets"
pulumi copilot "generate a load-balanced web app"
```

### Cross-Language Components
```typescript
// Use Python component in TypeScript
import * as python from "@pulumi/python";
const component = new python.MyPythonComponent("my-comp", {});
```

## 📊 Impact Metrics (Memorize for Interviews)

- **85% faster deployments** (typical improvement with Pulumi)
- **35% cost reduction** (through better resource optimization)
- **95% test coverage** (achievable with proper testing)
- **500 resources** = CloudFormation limit per stack (not 200 or 1000)
- **2021** = When cross-language components became available (Pulumi 3.0)
- **2023** = Terraform moved to Business Source License (BSL)

## 🔧 Configuration Patterns

### Environment-Specific Config
```typescript
const config = new pulumi.Config();
const env = config.require("environment");
const region = config.require("aws:region");

// Conditional logic based on environment
const instanceType = env === "prod" ? "m5.large" : "t3.micro";
const replicas = env === "prod" ? 3 : 1;

// Secrets (auto-encrypted)
const dbPassword = config.requireSecret("dbPassword");
```

### Stack References
```typescript
// Export from stack A
export const vpcId = vpc.id;

// Import in stack B
const sharedStack = new pulumi.StackReference("org/shared/prod");
const vpcId = sharedStack.getOutput("vpcId");
```

## 🧪 Testing Essentials

### Unit Test Pattern
```typescript
import * as testing from "@pulumi/pulumi/testing";

describe("WebService", () => {
    beforeEach(() => testing.setMocks({
        newResource: (args) => ({ id: args.name + "_id", state: args.inputs })
    }));
    
    it("creates bucket", async () => {
        const infra = testing.runPulumiProgram(() => {
            return new WebService("test", { domain: "test.com" });
        });
        
        const resources = await infra.resources;
        expect(resources.find(r => r.type === "aws:s3:Bucket")).toBeDefined();
    });
});
```

## 🚀 CI/CD Quick Setup

### GitHub Actions (v5)
```yaml
- uses: pulumi/actions@v5
  with:
    command: up
    stack-name: production
  env:
    PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

### GitLab CI
```yaml
deploy:
  before_script:
    - curl -fsSL https://get.pulumi.com | sh
    - export PATH=$PATH:$HOME/.pulumi/bin
  script:
    - pulumi up --yes
```

## 🔍 Debugging Checklist

When deployment fails:
1. **Check syntax**: `tsc --noEmit` (TypeScript compile check)
2. **Verbose logs**: `pulumi up --logtostderr -v=9`
3. **State issues**: `pulumi refresh --diff`
4. **Dependencies**: Look for circular references
5. **Quotas**: Check AWS service limits
6. **Permissions**: Verify IAM roles

## ⏱️ Interview Day Strategy

### 1-Minute Elevator Pitch
"I'm a DevOps engineer specializing in Pulumi with TypeScript. I've reduced deployment times by 85% through reusable infrastructure components and automated CI/CD pipelines. My focus is on type-safe infrastructure that can be tested and maintained like application code."

### Questions to Ask Interviewers
- "How do you currently manage infrastructure state and deployments?"
- "What's your approach to testing infrastructure code?"
- "How large are your typical Pulumi stacks in terms of resource count?"

### Red Flags to Avoid
- Don't mention features that don't exist yet
- Don't confuse CloudFormation limits (it's 500, not 200/1000)  
- Don't use `.toString()` on Outputs in live coding
- Don't forget `registerOutputs()` in components

## 📱 Mobile-Friendly Commands
For quick lookup on your phone:

```bash
# Most common operations
pulumi stack select <name>
pulumi config set key value
pulumi up --yes
pulumi destroy --yes

# Emergency debugging  
pulumi refresh --diff
pulumi state delete <urn>
pulumi stack export > backup.json
```

## 🎯 Final Interview Tips

1. **Start simple** - Don't over-engineer initial solutions
2. **Think out loud** - Explain your reasoning
3. **Ask clarifying questions** - Understand requirements first
4. **Use exact terminology** - "Pulumi TypeScript SDK" not just "Pulumi"
5. **Show testing mindset** - Mention how you'd test the solution
6. **Be honest** - Say "I don't know but here's how I'd find out"

**Remember**: Most interviewers care more about your problem-solving approach than memorizing every API!

Good luck! 🚀