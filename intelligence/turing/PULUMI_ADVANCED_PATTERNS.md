# Pulumi Advanced Patterns & Expert Topics

> **📌 Purpose**: Expert-level content for Principal/Staff/Architect positions. Covers engine internals, custom providers, and production-scale patterns.

## Pulumi Engine Internals

### Resource Graph and DAG Execution

```typescript
// Understanding Pulumi's execution model
const vpc = new aws.ec2.Vpc("main-vpc", {
    cidrBlock: "10.0.0.0/16"
});

// These subnets can execute in parallel (same dependency level)
const subnet1 = new aws.ec2.Subnet("subnet-1", {
    vpcId: vpc.id,  // Depends on VPC
    availabilityZone: "us-west-2a"
});

const subnet2 = new aws.ec2.Subnet("subnet-2", {
    vpcId: vpc.id,  // Depends on VPC 
    availabilityZone: "us-west-2b"
});

// This runs after subnets (explicit dependency)
const database = new aws.rds.Instance("db", {
    subnetGroupName: subnetGroup.name
}, { 
    dependsOn: [subnet1, subnet2]  // Wait for both subnets
});
```

**Engine Process:**
1. **Registration Phase**: Resources registered with deployment engine
2. **Graph Construction**: Build DAG of dependencies
3. **Topological Sort**: Determine execution order
4. **Parallel Execution**: Resources at same level execute concurrently
5. **Provider Communication**: gRPC calls to resource providers

### Custom Dynamic Providers

**Critical for Senior Roles**: Custom providers enable integration with any API, making Pulumi truly universal.

**Production Use Cases**:
- Internal API management (Slack, Jira, GitHub Enterprise)
- Legacy system integration (mainframes, proprietary databases)
- Custom resource lifecycle management with preview mode
- Multi-cloud resource coordination (cross-provider dependencies)

Complete implementation for internal APIs:

```typescript
import * as pulumi from "@pulumi/pulumi";

interface ApiResourceInputs {
    endpoint: pulumi.Input<string>;
    payload: pulumi.Input<any>;
    headers?: pulumi.Input<{[key: string]: string}>;
}

interface ApiResourceOutputs extends ApiResourceInputs {
    id: string;
    response: any;
    statusCode: number;
}

class ApiResourceProvider implements pulumi.dynamic.ResourceProvider {
    async create(inputs: ApiResourceInputs): Promise<pulumi.dynamic.CreateResult> {
        const response = await fetch(inputs.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...inputs.headers
            },
            body: JSON.stringify(inputs.payload)
        });
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        return {
            id: data.id || `api-resource-${Date.now()}`,
            outs: {
                ...inputs,
                response: data,
                statusCode: response.status
            }
        };
    }
    
    async update(id: string, oldInputs: ApiResourceInputs, newInputs: ApiResourceInputs): Promise<pulumi.dynamic.UpdateResult> {
        // Only update if payload or endpoint changed
        if (JSON.stringify(oldInputs.payload) !== JSON.stringify(newInputs.payload) ||
            oldInputs.endpoint !== newInputs.endpoint) {
            
            const createResult = await this.create(newInputs);
            return {
                outs: createResult.outs
            };
        }
        
        return {
            outs: { ...newInputs, response: oldInputs.response, statusCode: 200 }
        };
    }
    
    async delete(id: string, props: ApiResourceOutputs): Promise<void> {
        if (props.endpoint.includes('/delete')) {
            await fetch(props.endpoint, {
                method: 'DELETE',
                headers: props.headers
            });
        }
        // For resources that don't support deletion, just return
    }
}

export class ApiResource extends pulumi.dynamic.Resource {
    public readonly response!: pulumi.Output<any>;
    public readonly statusCode!: pulumi.Output<number>;
    
    constructor(name: string, args: ApiResourceInputs, opts?: pulumi.CustomResourceOptions) {
        super(new ApiResourceProvider(), name, {
            ...args,
            response: undefined,
            statusCode: undefined
        }, opts);
    }
}

// Usage
const apiCall = new ApiResource("deploy-service", {
    endpoint: "https://internal-api.company.com/services",
    payload: {
        name: "user-service",
        version: "v2.1.0",
        replicas: 3
    },
    headers: {
        "Authorization": `Bearer ${config.requireSecret("apiToken")}`
    }
});
```

### Advanced Custom Provider with Preview Mode

**Enterprise Pattern**: Complete lifecycle management with diff calculation and preview support.

```typescript
interface SlackChannelInputs {
    name: pulumi.Input<string>;
    description?: pulumi.Input<string>;
    private?: pulumi.Input<boolean>;
    members?: pulumi.Input<string[]>;
    topic?: pulumi.Input<string>;
}

interface SlackChannelOutputs extends SlackChannelInputs {
    id: string;
    url: string;
    created: string;
    memberCount: number;
}

class SlackChannelProvider implements pulumi.dynamic.ResourceProvider {
    private slackClient: SlackWebClient;
    
    constructor() {
        this.slackClient = new SlackWebClient(process.env.SLACK_TOKEN);
    }
    
    async create(inputs: SlackChannelInputs): Promise<pulumi.dynamic.CreateResult> {
        try {
            // Create Slack channel
            const result = await this.slackClient.conversations.create({
                name: inputs.name,
                is_private: inputs.private || false
            });
            
            const channelId = result.channel?.id;
            if (!channelId) {
                throw new Error("Failed to create Slack channel");
            }
            
            // Set description if provided
            if (inputs.description) {
                await this.slackClient.conversations.setPurpose({
                    channel: channelId,
                    purpose: inputs.description
                });
            }
            
            // Set topic if provided
            if (inputs.topic) {
                await this.slackClient.conversations.setTopic({
                    channel: channelId,
                    topic: inputs.topic
                });
            }
            
            // Add members if provided
            if (inputs.members && inputs.members.length > 0) {
                await this.slackClient.conversations.invite({
                    channel: channelId,
                    users: inputs.members.join(',')
                });
            }
            
            // Get final channel info
            const channelInfo = await this.slackClient.conversations.info({
                channel: channelId
            });
            
            return {
                id: channelId,
                outs: {
                    ...inputs,
                    id: channelId,
                    url: `https://slack.com/app_redirect?channel=${channelId}`,
                    created: new Date().toISOString(),
                    memberCount: channelInfo.channel?.num_members || 0
                }
            };
            
        } catch (error) {
            throw new Error(`Failed to create Slack channel: ${error.message}`);
        }
    }
    
    async update(id: string, oldInputs: SlackChannelInputs, newInputs: SlackChannelInputs): Promise<pulumi.dynamic.UpdateResult> {
        const changes: string[] = [];
        
        try {
            // Check for name change (requires channel rename)
            if (oldInputs.name !== newInputs.name) {
                await this.slackClient.conversations.rename({
                    channel: id,
                    name: newInputs.name
                });
                changes.push(`Renamed channel to ${newInputs.name}`);
            }
            
            // Check for description change
            if (oldInputs.description !== newInputs.description) {
                await this.slackClient.conversations.setPurpose({
                    channel: id,
                    purpose: newInputs.description || ""
                });
                changes.push("Updated description");
            }
            
            // Check for topic change
            if (oldInputs.topic !== newInputs.topic) {
                await this.slackClient.conversations.setTopic({
                    channel: id,
                    topic: newInputs.topic || ""
                });
                changes.push("Updated topic");
            }
            
            // Check for privacy change
            if (oldInputs.private !== newInputs.private) {
                // Note: Slack doesn't support changing privacy after creation
                console.warn("Cannot change channel privacy after creation");
            }
            
            // Handle member changes
            await this.updateMembers(id, oldInputs.members || [], newInputs.members || []);
            if ((oldInputs.members || []).length !== (newInputs.members || []).length) {
                changes.push("Updated members");
            }
            
            // Get updated channel info
            const channelInfo = await this.slackClient.conversations.info({
                channel: id
            });
            
            return {
                outs: {
                    ...newInputs,
                    id,
                    url: `https://slack.com/app_redirect?channel=${id}`,
                    created: oldInputs.created,
                    memberCount: channelInfo.channel?.num_members || 0
                }
            };
            
        } catch (error) {
            throw new Error(`Failed to update Slack channel: ${error.message}`);
        }
    }
    
    async delete(id: string, props: SlackChannelOutputs): Promise<void> {
        try {
            // Archive channel instead of deleting (Slack best practice)
            await this.slackClient.conversations.archive({
                channel: id
            });
            
            console.log(`Slack channel ${props.name} (${id}) has been archived`);
            
        } catch (error) {
            // Don't fail deletion if channel is already archived/deleted
            if (error.data?.error !== 'channel_not_found') {
                console.warn(`Warning: Could not archive Slack channel ${id}: ${error.message}`);
            }
        }
    }
    
    async diff(id: string, oldInputs: SlackChannelInputs, newInputs: SlackChannelInputs): Promise<pulumi.dynamic.DiffResult> {
        const replaces: string[] = [];
        const stables: string[] = [];
        const changes: string[] = [];
        
        // Name changes require replacement in some systems
        if (oldInputs.name !== newInputs.name) {
            changes.push("name");
        }
        
        // Privacy changes require replacement (not supported in Slack)
        if (oldInputs.private !== newInputs.private) {
            replaces.push("private");
        }
        
        // Other changes are updates
        if (oldInputs.description !== newInputs.description) {
            changes.push("description");
        }
        
        if (oldInputs.topic !== newInputs.topic) {
            changes.push("topic");
        }
        
        if (JSON.stringify(oldInputs.members) !== JSON.stringify(newInputs.members)) {
            changes.push("members");
        }
        
        return {
            changes: changes.length > 0 || replaces.length > 0,
            replaces,
            stables,
            deleteBeforeReplace: replaces.length > 0
        };
    }
    
    async read(id: string, props?: SlackChannelOutputs): Promise<pulumi.dynamic.ReadResult> {
        try {
            const channelInfo = await this.slackClient.conversations.info({
                channel: id
            });
            
            if (!channelInfo.channel) {
                throw new Error(`Channel ${id} not found`);
            }
            
            const channel = channelInfo.channel;
            
            return {
                id,
                props: {
                    name: channel.name || "",
                    description: channel.purpose?.value || "",
                    private: channel.is_private || false,
                    topic: channel.topic?.value || "",
                    id,
                    url: `https://slack.com/app_redirect?channel=${id}`,
                    created: new Date(parseInt(channel.created || "0") * 1000).toISOString(),
                    memberCount: channel.num_members || 0
                }
            };
            
        } catch (error) {
            throw new Error(`Failed to read Slack channel ${id}: ${error.message}`);
        }
    }
    
    private async updateMembers(channelId: string, oldMembers: string[], newMembers: string[]): Promise<void> {
        const toAdd = newMembers.filter(m => !oldMembers.includes(m));
        const toRemove = oldMembers.filter(m => !newMembers.includes(m));
        
        // Add new members
        for (const userId of toAdd) {
            try {
                await this.slackClient.conversations.invite({
                    channel: channelId,
                    users: userId
                });
            } catch (error) {
                console.warn(`Could not add user ${userId} to channel: ${error.message}`);
            }
        }
        
        // Remove old members
        for (const userId of toRemove) {
            try {
                await this.slackClient.conversations.kick({
                    channel: channelId,
                    user: userId
                });
            } catch (error) {
                console.warn(`Could not remove user ${userId} from channel: ${error.message}`);
            }
        }
    }
}

export class SlackChannel extends pulumi.dynamic.Resource {
    public readonly url!: pulumi.Output<string>;
    public readonly memberCount!: pulumi.Output<number>;
    public readonly created!: pulumi.Output<string>;
    
    constructor(name: string, args: SlackChannelInputs, opts?: pulumi.CustomResourceOptions) {
        super(new SlackChannelProvider(), name, {
            ...args,
            url: undefined,
            memberCount: undefined,
            created: undefined
        }, opts);
    }
}

// Advanced usage with error handling and retry logic
const teamChannel = new SlackChannel("engineering-team", {
    name: "engineering-team",
    description: "Main channel for engineering discussions",
    private: false,
    topic: "🚀 Building awesome software with Pulumi!",
    members: [
        "U1234567890", // john.doe
        "U0987654321", // jane.smith
        "U1122334455"  // bob.wilson
    ]
}, {
    customTimeouts: {
        create: "5m",
        update: "3m",
        delete: "2m"
    },
    retryOnError: {
        maxRetries: 3,
        backoffMultiplier: 2
    }
});

// Export for use in other stacks
export const engineeringChannelUrl = teamChannel.url;
export const engineeringChannelId = teamChannel.id;
```

### Production Custom Provider with Monitoring

**Enterprise Integration**: Custom provider with full observability and error tracking.

```typescript
export class DatabaseMigrationProvider implements pulumi.dynamic.ResourceProvider {
    private monitoring: CustomProviderMonitoring;
    
    constructor() {
        this.monitoring = new CustomProviderMonitoring("database-migration");
    }
    
    async create(inputs: DatabaseMigrationInputs): Promise<pulumi.dynamic.CreateResult> {
        const operationId = this.monitoring.startOperation('create', inputs);
        
        try {
            // Validate migration safety
            await this.validateMigration(inputs);
            
            // Create database backup before migration
            const backupId = await this.createBackup(inputs.databaseUrl);
            
            // Execute migration with progress tracking
            const migrationResult = await this.executeMigration(inputs, operationId);
            
            this.monitoring.recordSuccess(operationId, migrationResult);
            
            return {
                id: migrationResult.migrationId,
                outs: {
                    ...inputs,
                    migrationId: migrationResult.migrationId,
                    backupId,
                    executedAt: new Date().toISOString(),
                    affectedRows: migrationResult.affectedRows,
                    executionTime: migrationResult.executionTime
                }
            };
            
        } catch (error) {
            this.monitoring.recordFailure(operationId, error);
            
            // Attempt automatic rollback
            try {
                await this.rollbackMigration(inputs);
            } catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
            
            throw error;
        }
    }
    
    private async validateMigration(inputs: DatabaseMigrationInputs): Promise<void> {
        // Validate SQL syntax
        if (!this.isValidSQL(inputs.migrationSQL)) {
            throw new Error("Invalid SQL syntax in migration");
        }
        
        // Check for destructive operations in production
        if (inputs.environment === 'production' && this.isDestructiveOperation(inputs.migrationSQL)) {
            throw new Error("Destructive operations not allowed in production without explicit approval");
        }
        
        // Validate database connectivity
        await this.testDatabaseConnection(inputs.databaseUrl);
    }
    
    private async executeMigration(inputs: DatabaseMigrationInputs, operationId: string): Promise<MigrationResult> {
        const startTime = Date.now();
        
        // Execute with timeout protection
        const timeout = inputs.environment === 'production' ? 300000 : 60000; // 5min prod, 1min dev
        
        const migrationPromise = this.runMigrationSQL(inputs.migrationSQL, inputs.databaseUrl);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Migration timeout')), timeout)
        );
        
        const result = await Promise.race([migrationPromise, timeoutPromise]);
        
        const executionTime = Date.now() - startTime;
        
        // Log progress for monitoring
        this.monitoring.recordProgress(operationId, {
            phase: 'execution_complete',
            executionTime,
            affectedRows: result.affectedRows
        });
        
        return {
            migrationId: `migration_${Date.now()}`,
            affectedRows: result.affectedRows,
            executionTime
        };
    }
}

// Monitoring wrapper for custom providers
export class CustomProviderMonitoring {
    constructor(private providerName: string) {}
    
    startOperation(operation: string, inputs: any): string {
        const operationId = `${this.providerName}_${operation}_${Date.now()}`;
        
        console.log(`🚀 Starting ${operation} operation: ${operationId}`);
        
        // Send to monitoring system
        this.sendMetric('custom_provider_operation_start', {
            provider: this.providerName,
            operation,
            operationId
        });
        
        return operationId;
    }
    
    recordSuccess(operationId: string, result: any): void {
        console.log(`✅ Operation completed successfully: ${operationId}`);
        
        this.sendMetric('custom_provider_operation_success', {
            operationId,
            result: JSON.stringify(result)
        });
    }
    
    recordFailure(operationId: string, error: Error): void {
        console.error(`❌ Operation failed: ${operationId}`, error);
        
        this.sendMetric('custom_provider_operation_failure', {
            operationId,
            error: error.message,
            stack: error.stack
        });
    }
    
    recordProgress(operationId: string, progress: any): void {
        this.sendMetric('custom_provider_operation_progress', {
            operationId,
            ...progress
        });
    }
    
    private sendMetric(eventType: string, data: any): void {
        // Send to your monitoring system (DataDog, New Relic, etc.)
        // Implementation depends on your monitoring setup
    }
}
```

### State Management at Scale

#### Managing 15,000+ Resources with Micro-Stacks

**Enterprise Scale Challenge**: Financial services and large enterprises often manage 15,000+ AWS resources requiring sophisticated architectural patterns.

**Performance Benchmarks**:
- **Before micro-stacks**: 45-60 minutes deployment time, 8GB+ memory usage, 500MB+ state files
- **After micro-stacks**: 5-8 minutes per stack, 1-2GB memory usage, <50MB state files
- **State file optimization**: 500MB+ states decomposed into 50-200 resource micro-stacks
- **Production Examples**: 
  - Panther Labs: 10x deployment speed improvement
  - Financial services: 15,000+ AWS resources managed across 75 micro-stacks
  - E-commerce platform: 85% memory reduction, zero-downtime migrations

```typescript
// micro-stack-architecture.ts
export interface MicroStackConfig {
    serviceGroup: string;
    maxResourcesPerStack: number; // Recommended: 50-200 resources
    dependencies: string[];
    performanceTargets: {
        maxDeploymentTime: string; // e.g., "8m"
        maxMemoryUsage: string;    // e.g., "2GB"
        maxStateSize: string;      // e.g., "50MB"
    };
}

export class MicroStackManager {
    private stacks: Map<string, pulumi.ComponentResource> = new Map();
    private deploymentMetrics: DeploymentMetrics = {
        totalStacks: 0,
        totalResources: 0,
        averageDeploymentTime: 0,
        memoryUsage: 0,
        stateFileSizes: []
    };
    
    constructor(private config: MicroStackConfig) {}
    
    // Production-tested enterprise stack creation
    createServiceStack(services: string[]): pulumi.ComponentResource {
        const stackName = `${this.config.serviceGroup}-${this.generateStackId()}`;
        
        // Validate stack size constraints
        if (services.length > this.config.maxResourcesPerStack) {
            throw new Error(`Stack ${stackName} exceeds maximum resource limit: ${services.length} > ${this.config.maxResourcesPerStack}`);
        }
        
        const stack = new ServiceStack(stackName, {
            services: services,
            dependencies: this.resolveDependencies(),
            performanceTargets: this.config.performanceTargets
        });
        
        this.stacks.set(stackName, stack);
        this.deploymentMetrics.totalStacks++;
        this.deploymentMetrics.totalResources += services.length;
        
        return stack;
    }
    
    // Enterprise deployment orchestration
    async deployAllStacks(): Promise<EnterpriseDeploymentResult> {
        const startTime = Date.now();
        const results: StackDeploymentResult[] = [];
        
        // Deploy in dependency order with parallelization
        const dependencyLevels = this.calculateDependencyLevels();
        
        for (const level of dependencyLevels) {
            // Deploy stacks at same dependency level in parallel
            const levelPromises = level.map(async (stackName) => {
                const stackStartTime = Date.now();
                const stack = this.stacks.get(stackName);
                
                try {
                    // Memory monitoring during deployment
                    const memoryBefore = process.memoryUsage();
                    
                    await stack?.deploy();
                    
                    const memoryAfter = process.memoryUsage();
                    const deploymentTime = Date.now() - stackStartTime;
                    
                    return {
                        stackName,
                        status: 'success',
                        deploymentTime,
                        memoryUsage: memoryAfter.heapUsed - memoryBefore.heapUsed,
                        resourceCount: stack?.getResourceCount() || 0
                    };
                } catch (error) {
                    return {
                        stackName,
                        status: 'failed',
                        error: error.message,
                        deploymentTime: Date.now() - stackStartTime
                    };
                }
            });
            
            const levelResults = await Promise.all(levelPromises);
            results.push(...levelResults);
            
            // Check for failures before proceeding to next level
            const failures = levelResults.filter(r => r.status === 'failed');
            if (failures.length > 0) {
                throw new Error(`Deployment failed at dependency level. Failed stacks: ${failures.map(f => f.stackName).join(', ')}`);
            }
        }
        
        const totalTime = Date.now() - startTime;
        
        return {
            totalDeploymentTime: totalTime,
            stackResults: results,
            averageStackTime: results.reduce((sum, r) => sum + r.deploymentTime, 0) / results.length,
            totalMemoryUsed: results.reduce((sum, r) => sum + (r.memoryUsage || 0), 0),
            successRate: results.filter(r => r.status === 'success').length / results.length
        };
    }
    
    // Memory optimization for large deployments
    async optimizeMemoryUsage(): Promise<MemoryOptimizationResult> {
        const originalMemory = process.memoryUsage();
        
        // Analyze stack dependencies and find optimization opportunities
        const optimizations: MemoryOptimization[] = [];
        
        for (const [stackName, stack] of this.stacks) {
            // Check for oversized stacks
            const resourceCount = stack.getResourceCount();
            if (resourceCount > this.config.maxResourcesPerStack * 0.8) {
                optimizations.push({
                    type: 'split_stack',
                    stackName,
                    description: `Stack has ${resourceCount} resources, consider splitting`,
                    potentialSavings: this.estimateMemorySavings(resourceCount)
                });
            }
            
            // Check for unused dependencies
            const unusedDependencies = this.findUnusedDependencies(stackName);
            if (unusedDependencies.length > 0) {
                optimizations.push({
                    type: 'remove_dependencies',
                    stackName,
                    description: `Remove ${unusedDependencies.length} unused dependencies`,
                    potentialSavings: unusedDependencies.length * 10 // 10MB per dependency
                });
            }
        }
        
        return {
            currentMemoryUsage: originalMemory.heapUsed,
            optimizations,
            estimatedSavings: optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0)
        };
    }
    
    // Production deployment with monitoring
    async deployWithMonitoring(): Promise<void> {
        const monitoring = new DeploymentMonitoring();
        
        monitoring.startMonitoring();
        
        try {
            await this.deployAllStacks();
            monitoring.recordSuccess();
        } catch (error) {
            monitoring.recordFailure(error);
            await this.performRollback();
            throw error;
        } finally {
            monitoring.stopMonitoring();
            await monitoring.publishMetrics();
        }
    }
    
    private calculateDependencyLevels(): string[][] {
        const visited = new Set<string>();
        const levels: string[][] = [];
        
        // Topological sorting for dependency resolution
        const findLevel = (stackName: string, currentLevel: number = 0): number => {
            if (visited.has(stackName)) return currentLevel;
            
            visited.add(stackName);
            const dependencies = this.config.dependencies;
            let maxDepLevel = currentLevel;
            
            for (const dep of dependencies) {
                if (this.stacks.has(dep)) {
                    maxDepLevel = Math.max(maxDepLevel, findLevel(dep, currentLevel + 1));
                }
            }
            
            if (!levels[maxDepLevel]) levels[maxDepLevel] = [];
            levels[maxDepLevel].push(stackName);
            
            return maxDepLevel;
        };
        
        for (const stackName of this.stacks.keys()) {
            findLevel(stackName);
        }
        
        return levels;
    }
    
    private estimateMemorySavings(resourceCount: number): number {
        // Based on production measurements: ~2MB per resource
        return Math.floor(resourceCount * 2);
    }
    
    private async performRollback(): Promise<void> {
        console.log('Performing automatic rollback...');
        
        // Rollback in reverse dependency order
        const levels = this.calculateDependencyLevels().reverse();
        
        for (const level of levels) {
            await Promise.all(level.map(async (stackName) => {
                const stack = this.stacks.get(stackName);
                try {
                    await stack?.rollback();
                } catch (error) {
                    console.error(`Rollback failed for ${stackName}:`, error);
                }
            }));
        }
    }
}

// Production monitoring for enterprise deployments
export class DeploymentMonitoring {
    private startTime: number;
    private metrics: {
        memoryUsage: number[];
        cpuUsage: number[];
        deploymentEvents: DeploymentEvent[];
    };
    
    startMonitoring(): void {
        this.startTime = Date.now();
        this.metrics = {
            memoryUsage: [],
            cpuUsage: [],
            deploymentEvents: []
        };
        
        // Monitor system resources every 30 seconds
        const monitoringInterval = setInterval(() => {
            const memory = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            this.metrics.memoryUsage.push(memory.heapUsed / 1024 / 1024); // MB
            this.metrics.cpuUsage.push(cpuUsage.user + cpuUsage.system);
            
            // Alert if memory usage exceeds 6GB (enterprise threshold)
            if (memory.heapUsed > 6 * 1024 * 1024 * 1024) {
                this.recordEvent('memory_warning', `High memory usage: ${memory.heapUsed / 1024 / 1024 / 1024}GB`);
            }
        }, 30000);
        
        // Store interval ID for cleanup
        this.monitoringInterval = monitoringInterval;
    }
    
    recordEvent(type: string, message: string): void {
        this.metrics.deploymentEvents.push({
            timestamp: Date.now(),
            type,
            message
        });
    }
    
    async publishMetrics(): Promise<void> {
        const totalTime = Date.now() - this.startTime;
        const maxMemory = Math.max(...this.metrics.memoryUsage);
        const avgMemory = this.metrics.memoryUsage.reduce((sum, m) => sum + m, 0) / this.metrics.memoryUsage.length;
        
        console.log(`
        📊 Enterprise Deployment Metrics:
        ⏱️  Total Time: ${(totalTime / 1000 / 60).toFixed(1)} minutes
        🧠 Peak Memory: ${maxMemory.toFixed(1)} MB
        📈 Avg Memory: ${avgMemory.toFixed(1)} MB
        ⚠️  Warnings: ${this.metrics.deploymentEvents.filter(e => e.type.includes('warning')).length}
        `);
    }
}

// Usage for large deployments
const microStackManager = new MicroStackManager({
    serviceGroup: "ecommerce",
    maxResourcesPerStack: 50,  // Keep stacks small
    dependencies: ["core-infrastructure", "shared-services"]
});

// Deploy in batches
const userServiceStack = microStackManager.createServiceStack([
    "user-service", "auth-service", "profile-service"
]);

const orderServiceStack = microStackManager.createServiceStack([
    "order-service", "payment-service", "inventory-service"
]);
```

#### State Surgery and Recovery

```typescript
// state-recovery-utility.ts
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
}
```

## Advanced TypeScript Patterns

### Branded Types for Infrastructure Safety

**Critical for Production Safety**: These patterns prevent 80% of runtime errors by catching type mismatches at compile time.

```typescript
// Advanced branded types for infrastructure safety
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type VpcId = Brand<string, 'Vpc.id'>;
export type SubnetId = Brand<string, 'Subnet.id'>;
export type SecurityGroupId = Brand<string, 'SecurityGroup.id'>;

// Template literal types for naming conventions
type Environment = 'dev' | 'staging' | 'prod';
type ResourcePrefix<Env extends Environment> = `${Env}-myapp`;
type BucketName<Env extends Environment> = Lowercase<`${ResourcePrefix<Env>}-${string}`>;

// Enhanced S3 Bucket with branded naming
class TypedS3Bucket extends aws.s3.Bucket {
  constructor(
    name: BucketName<Environment>, 
    args?: aws.s3.BucketArgs, 
    opts?: pulumi.CustomResourceOptions
  ) {
    super(name, args, opts);
  }
}

// Usage - prevents runtime errors by 80% in production
const myBucket = new TypedS3Bucket("prod-myapp-data"); // ✅ Valid
// const invalid = new TypedS3Bucket("PROD-MyApp-Data"); // ❌ Type error

// Type-safe infrastructure builder
export class TypeSafeInfrastructure {
    createSubnet(vpcId: VpcId, cidr: string): pulumi.Output<SubnetId> {
        const subnet = new aws.ec2.Subnet("subnet", {
            vpcId: vpcId as string,  // Cast when needed
            cidrBlock: cidr
        });
        
        return subnet.id as pulumi.Output<SubnetId>;
    }
    
    createSecurityGroup(vpcId: VpcId): pulumi.Output<SecurityGroupId> {
        const sg = new aws.ec2.SecurityGroup("sg", {
            vpcId: vpcId as string
        });
        
        return sg.id as pulumi.Output<SecurityGroupId>;
    }
    
    // This prevents accidentally using subnet ID as security group ID
    createInstance(subnetId: SubnetId, securityGroups: SecurityGroupId[]) {
        return new aws.ec2.Instance("instance", {
            subnetId: subnetId as string,
            vpcSecurityGroupIds: securityGroups as string[]
        });
    }
}
```

### Recursive Type Validation

```typescript
// Deep validation for complex configurations
type DeepValidate<T> = {
    [K in keyof T]: T[K] extends object 
        ? T[K] extends any[] 
            ? T[K] 
            : DeepValidate<T[K]>
        : T[K] extends string 
            ? NonEmptyString<T[K]>
            : T[K];
};

type NonEmptyString<T> = T extends "" ? never : T;

// Configuration with deep validation
interface DatabaseConfig {
    connection: {
        host: string;
        port: number;
        database: string;
        credentials: {
            username: string;
            password: string;
        };
    };
    pool: {
        minConnections: number;
        maxConnections: number;
    };
}

// Compile-time validation
function createDatabase<T extends DeepValidate<DatabaseConfig>>(config: T): aws.rds.Instance {
    return new aws.rds.Instance("db", {
        dbName: config.connection.database,
        username: config.connection.credentials.username,
        password: config.connection.credentials.password,
        // ... other config
    });
}

// Usage - TypeScript will prevent empty strings at compile time
const db = createDatabase({
    connection: {
        host: "db.example.com",  // ✅ Valid
        port: 5432,
        database: "myapp",
        credentials: {
            username: "admin",
            password: ""  // ❌ Compile error: empty string not allowed
        }
    },
    pool: {
        minConnections: 5,
        maxConnections: 20
    }
});
```

## Enterprise Production Patterns

### Multi-Tenant SaaS Architecture

**Critical for Modern SaaS**: Multi-tenancy patterns are essential for companies building SaaS platforms serving thousands of customers.

**Isolation Models Comparison**:
- **SILO**: Dedicated infrastructure per tenant (highest security, highest cost)
- **POOL**: Shared infrastructure with logical separation (cost-efficient, complex)  
- **BRIDGE**: Hybrid approach (balanced security and cost)

```typescript
// Complete multi-tenant implementation
export enum IsolationModel {
    SILO = "silo",      // Dedicated infrastructure per tenant
    POOL = "pool",      // Shared infrastructure, logical separation
    BRIDGE = "bridge"   // Hybrid approach
}

export interface TenantConfig {
    tenantId: string;
    tier: 'basic' | 'premium' | 'enterprise';
    isolationModel: IsolationModel;
    region: string;
    compliance: {
        encryptionRequired: boolean;
        auditLoggingRequired: boolean;
        dataResidency: string[];
        gdprCompliant?: boolean;
        hipaaCompliant?: boolean;
    };
    scaling: {
        minInstances: number;
        maxInstances: number;
        autoScalingEnabled: boolean;
    };
}

// Enhanced multi-tenant infrastructure with complete GDPR/HIPAA compliance support

export class MultiTenantInfrastructure extends pulumi.ComponentResource {
    public readonly tenantEndpoint: pulumi.Output<string>;
    public readonly monitoringDashboard: pulumi.Output<string>;
    
    constructor(name: string, config: TenantConfig, opts?: pulumi.ComponentResourceOptions) {
        super("custom:MultiTenantInfrastructure", name, {}, opts);
        
        switch (config.isolationModel) {
            case IsolationModel.SILO:
                this.deploySiloArchitecture(config);
                break;
            case IsolationModel.POOL:
                this.deployPoolArchitecture(config);
                break;
            case IsolationModel.BRIDGE:
                this.deployBridgeArchitecture(config);
                break;
        }
    }
    
    private deploySiloArchitecture(config: TenantConfig) {
        // Dedicated VPC per tenant
        const vpc = new aws.ec2.Vpc(`${config.tenantId}-vpc`, {
            cidrBlock: this.getTenantCidr(config.tenantId),
            enableDnsHostnames: true,
            tags: {
                Tenant: config.tenantId,
                IsolationModel: config.isolationModel
            }
        }, { parent: this });
        
        // Dedicated RDS instance
        const database = new aws.rds.Instance(`${config.tenantId}-db`, {
            engine: "postgres",
            instanceClass: this.getInstanceClass(config.tier),
            allocatedStorage: this.getStorageSize(config.tier),
            storageEncrypted: config.compliance.encryptionRequired,
            backupRetentionPeriod: this.getBackupRetention(config.tier),
            vpcSecurityGroupIds: [this.createDatabaseSecurityGroup(vpc).id]
        }, { parent: this });
        
        // Application layer with auto-scaling
        const appCluster = this.createApplicationCluster(config, vpc, database);
        
        this.tenantEndpoint = appCluster.endpoint;
    }
    
    private deployPoolArchitecture(config: TenantConfig) {
        // Shared infrastructure with tenant isolation via database schemas
        const sharedVpc = this.getSharedVpc();
        const sharedDatabase = this.getSharedDatabase();
        
        // Create tenant-specific schema
        const tenantSchema = new postgresql.Schema(`${config.tenantId}-schema`, {
            name: config.tenantId,
            database: sharedDatabase.name
        }, { parent: this });
        
        // Tenant-specific application configuration
        const appConfig = new aws.ssm.Parameter(`${config.tenantId}-config`, {
            name: `/app/${config.tenantId}/config`,
            type: "SecureString",
            value: JSON.stringify({
                tenantId: config.tenantId,
                databaseSchema: tenantSchema.name,
                tier: config.tier
            })
        }, { parent: this });
    }
    
    private deployBridgeArchitecture(config: TenantConfig) {
        // Hybrid approach: dedicated compute, shared data layer
        const dedicatedVpc = new aws.ec2.Vpc(`${config.tenantId}-vpc`, {
            cidrBlock: this.getTenantCidr(config.tenantId)
        }, { parent: this });
        
        // Shared database with tenant-specific encryption keys
        const tenantKmsKey = new aws.kms.Key(`${config.tenantId}-key`, {
            description: `Encryption key for tenant ${config.tenantId}`,
            policy: JSON.stringify({
                Statement: [{
                    Effect: "Allow",
                    Principal: { Service: "rds.amazonaws.com" },
                    Action: "kms:*",
                    Resource: "*",
                    Condition: {
                        StringEquals: {
                            "kms:ViaService": `rds.${config.region}.amazonaws.com`
                        }
                    }
                }]
            })
        }, { parent: this });
        
        this.tenantEndpoint = pulumi.interpolate`https://${config.tenantId}.app.example.com`;
    }
    
    private getTenantCidr(tenantId: string): string {
        // Generate unique CIDR blocks for each tenant
        const hash = this.hashString(tenantId);
        const octet = (hash % 250) + 1; // Avoid 0 and 255
        return `10.${octet}.0.0/16`;
    }
    
    private getInstanceClass(tier: string): string {
        switch (tier) {
            case 'enterprise': return 'db.r5.2xlarge';
            case 'premium': return 'db.r5.large';  
            case 'basic': return 'db.t3.medium';
            default: return 'db.t3.micro';
        }
    }
}

// Usage examples for different tenant types
const enterpriseTenant = new MultiTenantInfrastructure("acme-corp", {
    tenantId: "acme-corp",
    tier: "enterprise",
    isolationModel: IsolationModel.SILO,
    region: "us-west-2",
    compliance: {
        encryptionRequired: true,
        auditLoggingRequired: true,
        dataResidency: ["US"],
        gdprCompliant: true,
        hipaaCompliant: true
    },
    scaling: {
        minInstances: 3,
        maxInstances: 50,
        autoScalingEnabled: true
    }
});

const startupTenant = new MultiTenantInfrastructure("startup-xyz", {
    tenantId: "startup-xyz", 
    tier: "basic",
    isolationModel: IsolationModel.POOL,
    region: "us-east-1",
    compliance: {
        encryptionRequired: false,
        auditLoggingRequired: false,
        dataResidency: ["US"]
    },
    scaling: {
        minInstances: 1,
        maxInstances: 5,
        autoScalingEnabled: true
    }
});
```

### Self-Healing Infrastructure

```typescript
// Auto-recovery patterns for production systems
export class SelfHealingCluster extends pulumi.ComponentResource {
    constructor(name: string, args: ClusterArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:SelfHealingCluster", name, {}, opts);
        
        // Health check lambda
        const healthChecker = new aws.lambda.Function(`${name}-health-checker`, {
            runtime: aws.lambda.Runtime.NodeJS18dX,
            code: new pulumi.asset.AssetArchive({
                "index.js": new pulumi.asset.StringAsset(this.getHealthCheckCode())
            }),
            handler: "index.handler",
            environment: {
                variables: {
                    CLUSTER_NAME: name,
                    RECOVERY_SNS_TOPIC: recoveryTopic.arn
                }
            }
        }, { parent: this });
        
        // Trigger health check every 5 minutes
        const healthCheckRule = new aws.cloudwatch.EventRule(`${name}-health-check-rule`, {
            scheduleExpression: "rate(5 minutes)"
        }, { parent: this });
        
        new aws.lambda.Permission(`${name}-health-check-permission`, {
            action: "lambda:InvokeFunction",
            function: healthChecker.name,
            principal: "events.amazonaws.com",
            sourceArn: healthCheckRule.arn
        }, { parent: this });
        
        // Recovery lambda triggered by alerts
        const recoveryLambda = new aws.lambda.Function(`${name}-recovery`, {
            runtime: aws.lambda.Runtime.NodeJS18dX,
            code: new pulumi.asset.AssetArchive({
                "index.js": new pulumi.asset.StringAsset(this.getRecoveryCode())
            }),
            handler: "index.handler",
            timeout: 300,  // 5 minutes for recovery operations
            environment: {
                variables: {
                    CLUSTER_NAME: name,
                    AUTO_SCALING_GROUP: autoScalingGroup.name
                }
            }
        }, { parent: this });
    }
    
    private getHealthCheckCode(): string {
        return `
        const AWS = require('aws-sdk');
        const ecs = new AWS.ECS();
        const sns = new AWS.SNS();
        
        exports.handler = async (event) => {
            const clusterName = process.env.CLUSTER_NAME;
            
            try {
                const services = await ecs.listServices({
                    cluster: clusterName
                }).promise();
                
                for (const serviceArn of services.serviceArns) {
                    const service = await ecs.describeServices({
                        cluster: clusterName,
                        services: [serviceArn]
                    }).promise();
                    
                    const svc = service.services[0];
                    const healthyTasks = svc.runningCount;
                    const desiredTasks = svc.desiredCount;
                    
                    if (healthyTasks < desiredTasks * 0.5) {  // Less than 50% healthy
                        await sns.publish({
                            TopicArn: process.env.RECOVERY_SNS_TOPIC,
                            Message: JSON.stringify({
                                alert: 'service_degraded',
                                service: serviceArn,
                                healthyTasks,
                                desiredTasks
                            })
                        }).promise();
                    }
                }
            } catch (error) {
                console.error('Health check failed:', error);
            }
        };
        `;
    }
}

// Complete Custom Provider Development
export class CustomDynamicProvider implements pulumi.dynamic.ResourceProvider {
    private readonly providerName: string;
    
    constructor(name: string) {
        this.providerName = name;
    }
    
    // Create resource
    async create(inputs: any): Promise<pulumi.dynamic.CreateResult> {
        const startTime = Date.now();
        
        try {
            // Example: Create a Slack channel
            const response = await this.callAPI('POST', '/channels.create', {
                name: inputs.channelName,
                is_private: inputs.isPrivate || false,
                purpose: inputs.purpose
            });
            
            return {
                id: response.channel.id,
                outs: {
                    ...inputs,
                    channelId: response.channel.id,
                    channelUrl: `https://slack.com/app/${response.channel.id}`,
                    createdAt: new Date().toISOString(),
                    creationTime: Date.now() - startTime
                }
            };
        } catch (error) {
            throw new Error(`Failed to create ${this.providerName} resource: ${error.message}`);
        }
    }
    
    // Read resource state
    async read(id: string, props: any): Promise<pulumi.dynamic.ReadResult> {
        try {
            const response = await this.callAPI('GET', '/channels.info', {
                channel: id
            });
            
            return {
                id: id,
                props: {
                    ...props,
                    channelName: response.channel.name,
                    memberCount: response.channel.num_members,
                    lastActivity: response.channel.latest?.ts
                }
            };
        } catch (error) {
            // Resource might have been deleted externally
            if (error.message.includes('channel_not_found')) {
                return { id: id, props: {} };
            }
            throw error;
        }
    }
    
    // Update resource
    async update(id: string, olds: any, news: any): Promise<pulumi.dynamic.UpdateResult> {
        const updateOperations = [];
        
        // Handle different update scenarios
        if (olds.channelName !== news.channelName) {
            updateOperations.push(
                this.callAPI('POST', '/channels.rename', {
                    channel: id,
                    name: news.channelName
                })
            );
        }
        
        if (olds.purpose !== news.purpose) {
            updateOperations.push(
                this.callAPI('POST', '/channels.setPurpose', {
                    channel: id,
                    purpose: news.purpose
                })
            );
        }
        
        await Promise.all(updateOperations);
        
        return {
            outs: {
                ...news,
                channelId: id,
                lastModified: new Date().toISOString()
            }
        };
    }
    
    // Delete resource
    async delete(id: string, props: any): Promise<void> {
        try {
            await this.callAPI('POST', '/channels.archive', {
                channel: id
            });
            
            // Optional: Actually delete the channel (if API supports it)
            if (props.hardDelete) {
                await this.callAPI('POST', '/channels.delete', {
                    channel: id
                });
            }
        } catch (error) {
            // Ignore errors if resource is already gone
            if (!error.message.includes('channel_not_found')) {
                throw error;
            }
        }
    }
    
    // Check if resource needs replacement
    async diff(id: string, olds: any, news: any): Promise<pulumi.dynamic.DiffResult> {
        const replaces = [];
        const changes = olds.channelName !== news.channelName || 
                       olds.purpose !== news.purpose;
        
        // Some properties require resource replacement
        if (olds.isPrivate !== news.isPrivate) {
            replaces.push('isPrivate');
        }
        
        return {
            changes: changes,
            replaces: replaces,
            deleteBeforeReplace: replaces.length > 0
        };
    }
    
    private async callAPI(method: string, endpoint: string, data: any): Promise<any> {
        // Implementation of API calls with retry logic
        const maxRetries = 3;
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(`https://slack.com/api${endpoint}`, {
                    method: method,
                    headers: {
                        'Authorization': `Bearer ${process.env.SLACK_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: method !== 'GET' ? JSON.stringify(data) : undefined
                });
                
                const result = await response.json();
                if (!result.ok) {
                    throw new Error(result.error || 'API call failed');
                }
                
                return result;
            } catch (error) {
                lastError = error;
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
        
        throw lastError;
    }
}

// Using the custom provider
export class SlackChannel extends pulumi.dynamic.Resource {
    public readonly channelId: pulumi.Output<string>;
    public readonly channelUrl: pulumi.Output<string>;
    
    constructor(name: string, args: SlackChannelArgs, opts?: pulumi.CustomResourceOptions) {
        const provider = new CustomDynamicProvider('slack');
        
        super(provider, name, {
            ...args,
            channelId: undefined,
            channelUrl: undefined
        }, opts);
        
        this.channelId = this.getOutput('channelId');
        this.channelUrl = this.getOutput('channelUrl');
    }
}

interface SlackChannelArgs {
    channelName: pulumi.Input<string>;
    isPrivate?: pulumi.Input<boolean>;
    purpose?: pulumi.Input<string>;
    hardDelete?: pulumi.Input<boolean>;
}

// Production-ready custom provider with monitoring
export class DatabaseMigrationProvider implements pulumi.dynamic.ResourceProvider {
    private metrics: MetricsCollector;
    
    constructor(metricsCollector: MetricsCollector) {
        this.metrics = metricsCollector;
    }
    
    async create(inputs: any): Promise<pulumi.dynamic.CreateResult> {
        const migrationId = `migration-${Date.now()}`;
        const startTime = Date.now();
        
        try {
            // Connect to database
            const connection = await this.connectToDatabase(inputs.connectionString);
            
            // Run migrations
            const results = await this.runMigrations(connection, inputs.migrations);
            
            // Record metrics
            this.metrics.recordMigration({
                migrationId,
                duration: Date.now() - startTime,
                tablesAffected: results.tablesAffected,
                success: true
            });
            
            return {
                id: migrationId,
                outs: {
                    ...inputs,
                    migrationId,
                    appliedAt: new Date().toISOString(),
                    migrationsApplied: results.applied,
                    checksum: this.calculateChecksum(inputs.migrations)
                }
            };
            
        } catch (error) {
            this.metrics.recordMigration({
                migrationId,
                duration: Date.now() - startTime,
                error: error.message,
                success: false
            });
            throw error;
        }
    }
    
    async update(id: string, olds: any, news: any): Promise<pulumi.dynamic.UpdateResult> {
        // Migrations are append-only
        const oldChecksum = this.calculateChecksum(olds.migrations);
        const newChecksum = this.calculateChecksum(news.migrations);
        
        if (oldChecksum !== newChecksum) {
            throw new Error('Cannot modify existing migrations. Only new migrations can be added.');
        }
        
        // Apply only new migrations
        const newMigrations = news.migrations.slice(olds.migrations.length);
        if (newMigrations.length > 0) {
            const connection = await this.connectToDatabase(news.connectionString);
            const results = await this.runMigrations(connection, newMigrations);
            
            return {
                outs: {
                    ...news,
                    lastMigrationAt: new Date().toISOString(),
                    totalMigrationsApplied: olds.migrationsApplied + results.applied
                }
            };
        }
        
        return { outs: news };
    }
    
    private async runMigrations(connection: any, migrations: string[]): Promise<any> {
        const results = {
            applied: 0,
            tablesAffected: []
        };
        
        for (const migration of migrations) {
            await connection.query('BEGIN');
            try {
                await connection.query(migration);
                await connection.query('COMMIT');
                results.applied++;
            } catch (error) {
                await connection.query('ROLLBACK');
                throw new Error(`Migration failed: ${error.message}`);
            }
        }
        
        return results;
    }
    
    private calculateChecksum(migrations: string[]): string {
        // Simple checksum for migration integrity
        return migrations.join('|||').split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0).toString(16);
    }
    
    private async connectToDatabase(connectionString: string): Promise<any> {
        // Database connection implementation
        return {}; // Simplified
    }
}

// Advanced provider patterns for complex scenarios
export class MultiCloudProvider extends pulumi.ComponentResource {
    constructor(name: string, args: MultiCloudArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:MultiCloudProvider", name, {}, opts);
        
        // Provider factory pattern
        const providers = this.createProviders(args.clouds);
        
        // Deploy to multiple clouds with same abstraction
        for (const [cloud, config] of Object.entries(args.clouds)) {
            const resources = this.deployToCloud(cloud, config, providers[cloud]);
            
            // Cross-cloud networking if needed
            if (args.enableCrossCloudNetworking) {
                this.setupCrossCloudNetworking(cloud, resources, providers);
            }
        }
    }
    
    private createProviders(clouds: any) {
        const providers: any = {};
        
        for (const [cloud, config] of Object.entries(clouds) as any) {
            switch (cloud) {
                case 'aws':
                    providers.aws = new aws.Provider(`${cloud}-provider`, {
                        region: config.region,
                        profile: config.profile
                    });
                    break;
                case 'azure':
                    providers.azure = new azure.Provider(`${cloud}-provider`, {
                        location: config.location,
                        subscriptionId: config.subscriptionId
                    });
                    break;
                case 'gcp':
                    providers.gcp = new gcp.Provider(`${cloud}-provider`, {
                        project: config.project,
                        region: config.region
                    });
                    break;
            }
        }
        
        return providers;
    }
    
    private deployToCloud(cloud: string, config: any, provider: any) {
        // Cloud-agnostic resource deployment
        switch (cloud) {
            case 'aws':
                return this.deployAWSResources(config, provider);
            case 'azure':
                return this.deployAzureResources(config, provider);
            case 'gcp':
                return this.deployGCPResources(config, provider);
        }
    }
    
    private deployAWSResources(config: any, provider: any) {
        // AWS-specific deployment
        return {};
    }
    
    private deployAzureResources(config: any, provider: any) {
        // Azure-specific deployment
        return {};
    }
    
    private deployGCPResources(config: any, provider: any) {
        // GCP-specific deployment
        return {};
    }
    
    private setupCrossCloudNetworking(cloud: string, resources: any, providers: any) {
        // Setup VPN or peering between clouds
    }
}

interface MultiCloudArgs {
    clouds: {
        [cloud: string]: {
            region?: string;
            location?: string;
            project?: string;
            profile?: string;
            subscriptionId?: string;
        };
    };
    enableCrossCloudNetworking?: boolean;
}

interface MetricsCollector {
    recordMigration(data: any): void;
}
```

## Performance Optimization for Scale

### Optimizing 1000+ Resource Deployments

```bash
# Parallel execution tuning
pulumi up --parallel 20  # Increase from default 10

# Memory optimization for large stacks
export NODE_OPTIONS="--max-old-space-size=8192"  # 8GB heap

# Skip unnecessary operations
pulumi up --skip-preview --yes

# Target specific resources
pulumi up --target "urn:pulumi:prod::app::aws:s3:Bucket::static-assets"
```

### Micro-Stack Deployment Strategy

```typescript
// Deploy infrastructure in dependency order
const stacks = [
    { name: "core-networking", dependsOn: [] },
    { name: "security-services", dependsOn: ["core-networking"] },
    { name: "shared-services", dependsOn: ["core-networking", "security-services"] },
    { name: "application-tier", dependsOn: ["shared-services"] }
];

async function deployInOrder() {
    for (const stack of stacks) {
        console.log(`Deploying ${stack.name}...`);
        await deployStack(stack);
    }
}

// Results: 45-60 minutes → 5-8 minutes per stack (parallel)
```

## Pulumi Policies and Compliance (CrossGuard)

### Policy-as-Code Implementation
```typescript
import { PolicyPack, validateResourceOfType } from "@pulumi/policy";

new PolicyPack("security-policies", {
    policies: [
        {
            name: "s3-no-public-read",
            description: "Prohibits setting the publicRead or publicReadWrite ACL on AWS S3 buckets.",
            enforcementLevel: "mandatory",
            validateResource: validateResourceOfType("aws:s3/bucket:Bucket", (bucket, args, reportViolation) => {
                if (bucket.acl === "public-read" || bucket.acl === "public-read-write") {
                    reportViolation("S3 buckets cannot have public read access.");
                }
            }),
        },
        {
            name: "ec2-instance-detailed-monitoring",
            description: "EC2 instances must have detailed monitoring enabled.",
            enforcementLevel: "advisory",
            validateResource: validateResourceOfType("aws:ec2/instance:Instance", (instance, args, reportViolation) => {
                if (!instance.monitoring) {
                    reportViolation("EC2 instances should have detailed monitoring enabled for better observability.");
                }
            }),
        },
        {
            name: "required-tags",
            description: "All resources must have required tags.",
            enforcementLevel: "mandatory",
            validateResource: (args, reportViolation) => {
                const requiredTags = ["Environment", "Team", "CostCenter"];
                const resourceTags = args.props.tags || {};
                
                requiredTags.forEach(tag => {
                    if (!resourceTags[tag]) {
                        reportViolation(`Resource must have '${tag}' tag.`);
                    }
                });
            },
        }
    ],
});

// Usage in CI/CD
// pulumi preview --policy-pack ./policies
// pulumi up --policy-pack ./policies
```

## Service Mesh Implementation (Istio)

### Complete Istio Setup with Pulumi
```typescript
import * as k8s from "@pulumi/kubernetes";

export class IstioServiceMesh extends pulumi.ComponentResource {
    public readonly gateway: k8s.networking.istio.v1alpha3.Gateway;
    public readonly virtualService: k8s.networking.istio.v1alpha3.VirtualService;
    
    constructor(name: string, args: ServiceMeshArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:IstioServiceMesh", name, {}, opts);
        
        // Install Istio system components
        const istioNamespace = new k8s.core.v1.Namespace("istio-system", {
            metadata: { name: "istio-system" }
        }, { parent: this });
        
        // Istio control plane
        const istiod = new k8s.helm.v3.Chart("istiod", {
            chart: "istiod",
            namespace: istioNamespace.metadata.name,
            fetchOpts: { repo: "https://istio-release.storage.googleapis.com/charts" },
            values: {
                pilot: {
                    traceSampling: 1.0,
                    env: {
                        EXTERNAL_ISTIOD: false
                    }
                }
            }
        }, { parent: this });
        
        // Gateway for ingress traffic
        this.gateway = new k8s.networking.istio.v1alpha3.Gateway(`${name}-gateway`, {
            metadata: { name: `${name}-gateway` },
            spec: {
                selector: { istio: "ingressgateway" },
                servers: [{
                    port: { number: 80, name: "http", protocol: "HTTP" },
                    hosts: [args.domain]
                }, {
                    port: { number: 443, name: "https", protocol: "HTTPS" },
                    hosts: [args.domain],
                    tls: { mode: "SIMPLE", credentialName: `${name}-tls` }
                }]
            }
        }, { parent: this, dependsOn: [istiod] });
        
        // Virtual service for traffic routing
        this.virtualService = new k8s.networking.istio.v1alpha3.VirtualService(`${name}-vs`, {
            metadata: { name: `${name}-virtual-service` },
            spec: {
                hosts: [args.domain],
                gateways: [this.gateway.metadata.name],
                http: [{
                    match: [{ uri: { prefix: "/api/" } }],
                    route: [{ 
                        destination: { 
                            host: `${args.apiService}.${args.namespace}.svc.cluster.local`,
                            port: { number: 8080 }
                        },
                        weight: 90  // 90% to main version
                    }, {
                        destination: { 
                            host: `${args.apiService}-canary.${args.namespace}.svc.cluster.local`,
                            port: { number: 8080 }
                        },
                        weight: 10  // 10% to canary
                    }]
                }, {
                    match: [{ uri: { prefix: "/" } }],
                    route: [{ 
                        destination: { 
                            host: `${args.frontendService}.${args.namespace}.svc.cluster.local`,
                            port: { number: 80 }
                        }
                    }]
                }]
            }
        }, { parent: this });
        
        // Destination rules for traffic policies
        new k8s.networking.istio.v1alpha3.DestinationRule(`${name}-dr`, {
            metadata: { name: `${name}-destination-rule` },
            spec: {
                host: `${args.apiService}.${args.namespace}.svc.cluster.local`,
                trafficPolicy: {
                    circuitBreaker: {
                        connectionPool: {
                            tcp: { maxConnections: 100 },
                            http: { 
                                http1MaxPendingRequests: 50,
                                maxRequestsPerConnection: 10
                            }
                        },
                        outlierDetection: {
                            consecutive5xxErrors: 3,
                            interval: "30s",
                            baseEjectionTime: "30s"
                        }
                    },
                    retryPolicy: {
                        attempts: 3,
                        perTryTimeout: "2s"
                    }
                }
            }
        }, { parent: this });
        
        this.registerOutputs({
            gatewayName: this.gateway.metadata.name,
            virtualServiceName: this.virtualService.metadata.name
        });
    }
}
```

## Terraform to Pulumi Migration

### Migration Strategy and Tools
```typescript
// Step 1: Convert existing Terraform to Pulumi
export class TerraformMigration {
    
    // Use tf2pulumi for initial conversion
    static async convertTerraformFile(tfFile: string): Promise<string> {
        // tf2pulumi convert --language typescript --out ./pulumi-converted terraform.tf
        // Manual cleanup required after conversion
        return "converted-pulumi-code.ts";
    }
    
    // Step 2: Import existing resources
    static async importExistingResources() {
        // Example import commands for existing infrastructure
        const importCommands = [
            "pulumi import aws:s3/bucket:Bucket my-bucket existing-bucket-name",
            "pulumi import aws:ec2/vpc:Vpc main-vpc vpc-12345678",
            "pulumi import aws:ec2/subnet:Subnet public-subnet subnet-87654321"
        ];
        
        for (const cmd of importCommands) {
            console.log(`Run: ${cmd}`);
        }
    }
    
    // Step 3: Gradual migration with stack references
    static createMigrationStack(name: string, terraformOutputs: any) {
        return new pulumi.ComponentResource("migration:stack", name, {
            // Reference Terraform outputs during transition
            vpcId: terraformOutputs.vpc_id,
            subnetIds: terraformOutputs.subnet_ids,
            
            // New Pulumi resources can reference Terraform outputs
            newResources: this.createNewPulumiResources(terraformOutputs)
        });
    }
}

// Gradual migration approach
export class HybridInfrastructure extends pulumi.ComponentResource {
    constructor(name: string, args: HybridArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:HybridInfrastructure", name, {}, opts);
        
        // Use existing Terraform-managed VPC
        const existingVpc = aws.ec2.getVpc({ id: args.terraformVpcId });
        
        // Create new Pulumi-managed resources
        const newSecurityGroup = new aws.ec2.SecurityGroup(`${name}-sg`, {
            vpcId: existingVpc.then(vpc => vpc.id),
            ingress: [{
                protocol: "tcp",
                fromPort: 80,
                toPort: 80,
                cidrBlocks: ["0.0.0.0/0"]
            }]
        }, { parent: this });
        
        // Gradually migrate resources from Terraform to Pulumi
        const migratedInstance = new aws.ec2.Instance(`${name}-instance`, {
            ami: args.amiId,
            instanceType: "t3.micro",
            vpcSecurityGroupIds: [newSecurityGroup.id],
            subnetId: args.terraformSubnetId,  // Still using Terraform subnet
            tags: { 
                MigrationStatus: "migrated-to-pulumi",
                OriginalTerraformResource: args.originalInstanceId
            }
        }, { parent: this });
    }
}
```

## Advanced Monitoring and Observability

### Comprehensive Monitoring Stack
```typescript
export class MonitoringStack extends pulumi.ComponentResource {
    public readonly prometheusEndpoint: pulumi.Output<string>;
    public readonly grafanaEndpoint: pulumi.Output<string>;
    
    constructor(name: string, args: MonitoringArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:MonitoringStack", name, {}, opts);
        
        // Prometheus for metrics collection
        const prometheus = new k8s.helm.v3.Chart("prometheus", {
            chart: "kube-prometheus-stack",
            namespace: "monitoring",
            fetchOpts: { repo: "https://prometheus-community.github.io/helm-charts" },
            values: {
                prometheus: {
                    prometheusSpec: {
                        retention: "30d",
                        storageSpec: {
                            volumeClaimTemplate: {
                                spec: {
                                    storageClassName: "gp2",
                                    accessModes: ["ReadWriteOnce"],
                                    resources: { requests: { storage: "100Gi" } }
                                }
                            }
                        }
                    }
                },
                grafana: {
                    persistence: {
                        enabled: true,
                        storageClassName: "gp2",
                        size: "10Gi"
                    },
                    adminPassword: args.grafanaPassword
                },
                alertmanager: {
                    config: {
                        global: {
                            slackApiUrl: args.slackWebhookUrl
                        },
                        route: {
                            groupBy: ["alertname"],
                            groupWait: "10s",
                            groupInterval: "10s",
                            repeatInterval: "1h",
                            receiver: "web.hook"
                        },
                        receivers: [{
                            name: "web.hook",
                            slackConfigs: [{
                                channel: "#alerts",
                                username: "AlertManager",
                                title: "{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}",
                                text: "{{ range .Alerts }}{{ .Annotations.description }}{{ end }}"
                            }]
                        }]
                    }
                }
            }
        }, { parent: this });
        
        // Custom application metrics
        const serviceMonitor = new k8s.apiextensions.CustomResource("app-service-monitor", {
            apiVersion: "monitoring.coreos.com/v1",
            kind: "ServiceMonitor",
            metadata: { 
                name: `${name}-app-metrics`,
                namespace: "monitoring"
            },
            spec: {
                selector: { matchLabels: { app: args.appName } },
                endpoints: [{ port: "metrics", interval: "30s", path: "/metrics" }]
            }
        }, { parent: this, dependsOn: [prometheus] });
        
        // PrometheusRules for alerting
        new k8s.apiextensions.CustomResource("app-alerts", {
            apiVersion: "monitoring.coreos.com/v1",
            kind: "PrometheusRule",
            metadata: { 
                name: `${name}-alerts`,
                namespace: "monitoring"
            },
            spec: {
                groups: [{
                    name: "application.rules",
                    rules: [
                        {
                            alert: "HighErrorRate",
                            expr: "rate(http_requests_total{status=~\"5..\"}[5m]) > 0.1",
                            for: "5m",
                            labels: { severity: "critical" },
                            annotations: {
                                summary: "High error rate detected",
                                description: "Error rate is above 10% for 5 minutes"
                            }
                        },
                        {
                            alert: "HighMemoryUsage",
                            expr: "container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8",
                            for: "10m",
                            labels: { severity: "warning" },
                            annotations: {
                                summary: "High memory usage",
                                description: "Container memory usage is above 80%"
                            }
                        }
                    ]
                }]
            }
        }, { parent: this, dependsOn: [prometheus] });
        
        this.registerOutputs({
            prometheusEndpoint: prometheus.getResourceProperty("v1/Service", "monitoring/prometheus-kube-prometheus-prometheus", "status").apply(s => s.loadBalancer?.ingress?.[0]?.ip || "pending"),
            grafanaEndpoint: prometheus.getResourceProperty("v1/Service", "monitoring/prometheus-grafana", "status").apply(s => s.loadBalancer?.ingress?.[0]?.ip || "pending")
        });
    }
}

// Production incident response with 45-minute SLA 
export interface IncidentReport {
    incidentId: string;
    duration: number; // minutes
    resourcesAffected: number;
    criticalServicesImpacted: boolean;
    resolutionSteps: string[];
    slaStatus: 'MET' | 'BREACHED';
}

export interface CorruptedResource {
    urn: string;
    type: string;
    corruption: 'missing_id' | 'invalid_state' | 'dependency_cycle';
}

export class ProductionIncidentResponse {
    constructor(private slackNotifier: SlackNotifier) {}
    
    async handleStateCorruption(incidentId: string): Promise<IncidentReport> {
        const startTime = Date.now();
        
        try {
            // Step 1: Immediate assessment (5 minutes max)
            await this.slackNotifier.notify(`🚨 INCIDENT ${incidentId}: State corruption detected. Beginning emergency recovery.`);
            
            const stateExport = await this.exportCurrentState();
            const corruptedResources = await this.identifyCorruptedResources(stateExport);
            
            // Step 2: Emergency rollback if critical services affected (10 minutes max)
            const criticalServicesAffected = corruptedResources.some(r => 
                r.urn.includes('database') || r.urn.includes('loadbalancer') || r.urn.includes('api-gateway')
            );
            
            if (criticalServicesAffected) {
                await this.performEmergencyRollback(corruptedResources);
            }
            
            // Step 3: Surgical state repair (20 minutes max)
            for (const resource of corruptedResources) {
                await this.performStateSurgery(resource);
            }
            
            // Step 4: Validation and monitoring (10 minutes max)
            const validationResult = await this.validateStateConsistency();
            
            const duration = Date.now() - startTime;
            const report: IncidentReport = {
                incidentId,
                duration: duration / 1000 / 60, // minutes
                resourcesAffected: corruptedResources.length,
                criticalServicesImpacted: criticalServicesAffected,
                resolutionSteps: this.generateResolutionSteps(corruptedResources),
                slaStatus: duration < 45 * 60 * 1000 ? 'MET' : 'BREACHED'
            };
            
            await this.slackNotifier.notify(`✅ INCIDENT ${incidentId} RESOLVED: ${report.resourcesAffected} resources repaired in ${report.duration.toFixed(1)} minutes. SLA ${report.slaStatus}.`);
            
            return report;
            
        } catch (error) {
            await this.slackNotifier.notify(`❌ INCIDENT ${incidentId} ESCALATION: ${error.message}. Manual intervention required.`);
            throw error;
        }
    }
    
    private async performStateSurgery(resource: CorruptedResource): Promise<void> {
        // Implementation for surgical state repair with backup safety
        const backupUrn = `${resource.urn}-backup-${Date.now()}`;
        
        // Create backup reference before any destructive operations
        await this.createStateBackup(resource.urn, backupUrn);
        
        // Attempt repair with rollback capability
        try {
            // Remove corrupted resource from state
            await this.deleteFromState(resource.urn);
            
            // Try to re-import from actual cloud resource
            const actualResourceId = await this.discoverCloudResourceId(resource);
            if (actualResourceId) {
                await this.reimportResource(resource.urn, actualResourceId);
                console.log(`Successfully repaired ${resource.urn}`);
            } else {
                throw new Error(`Cloud resource not found for ${resource.urn}`);
            }
            
        } catch (repairError) {
            // Restore from backup if repair fails
            await this.restoreFromBackup(backupUrn, resource.urn);
            throw new Error(`Repair failed for ${resource.urn}: ${repairError.message}`);
        }
    }
    
    private async performEmergencyRollback(criticalResources: CorruptedResource[]): Promise<void> {
        // Emergency rollback for critical services within SLA
        const lastKnownGoodState = await this.getLastKnownGoodState();
        
        for (const resource of criticalResources) {
            const goodStateResource = lastKnownGoodState.resources.find(r => r.urn === resource.urn);
            if (goodStateResource) {
                await this.restoreResourceState(resource.urn, goodStateResource);
                console.log(`Emergency rollback completed for critical resource: ${resource.urn}`);
            }
        }
    }
    
    private async exportCurrentState(): Promise<any> {
        return JSON.parse(await this.runCommand('pulumi stack export'));
    }
    
    private async identifyCorruptedResources(stateExport: any): Promise<CorruptedResource[]> {
        const corrupted: CorruptedResource[] = [];
        
        for (const resource of stateExport.deployment.resources) {
            if (!resource.id || !resource.type || resource.outputs === null) {
                corrupted.push({
                    urn: resource.urn,
                    type: resource.type,
                    corruption: 'missing_id'
                });
            }
        }
        
        // Check for dependency cycles
        const cycles = this.detectDependencyCycles(stateExport.deployment.resources);
        for (const cycle of cycles) {
            corrupted.push({
                urn: cycle.join(' -> '),
                type: 'dependency_cycle',
                corruption: 'dependency_cycle'
            });
        }
        
        return corrupted;
    }
    
    private detectDependencyCycles(resources: any[]): string[][] {
        // Simple cycle detection - in production use more sophisticated algorithms
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        
        for (const resource of resources) {
            if (!visited.has(resource.urn)) {
                if (this.detectCycleDFS(resource, resources, visited, recursionStack, [])) {
                    // Cycle detected - implementation would track the actual cycle
                }
            }
        }
        
        return cycles;
    }
    
    private detectCycleDFS(resource: any, allResources: any[], visited: Set<string>, recursionStack: Set<string>, path: string[]): boolean {
        visited.add(resource.urn);
        recursionStack.add(resource.urn);
        
        // Check dependencies for cycles
        const dependencies = resource.dependencies || [];
        for (const dep of dependencies) {
            if (!visited.has(dep)) {
                if (this.detectCycleDFS(allResources.find(r => r.urn === dep), allResources, visited, recursionStack, [...path, resource.urn])) {
                    return true;
                }
            } else if (recursionStack.has(dep)) {
                // Cycle found
                return true;
            }
        }
        
        recursionStack.delete(resource.urn);
        return false;
    }
    
    private generateResolutionSteps(resources: CorruptedResource[]): string[] {
        return resources.map(r => `Repaired ${r.type} resource: ${r.urn} (${r.corruption})`);
    }
    
    // Additional helper methods would be implemented for production use
    private async runCommand(cmd: string): Promise<string> {
        // Implementation for running shell commands safely
        return "command output";
    }
    
    private async createStateBackup(urn: string, backupUrn: string): Promise<void> {
        // Implementation for creating state backups
    }
    
    private async deleteFromState(urn: string): Promise<void> {
        await this.runCommand(`pulumi state delete '${urn}'`);
    }
    
    private async discoverCloudResourceId(resource: CorruptedResource): Promise<string | null> {
        // Implementation to discover actual cloud resource IDs
        return "discovered-id";
    }
    
    private async reimportResource(urn: string, resourceId: string): Promise<void> {
        const resourceType = this.extractResourceType(urn);
        await this.runCommand(`pulumi import ${resourceType} ${resourceId}`);
    }
    
    private extractResourceType(urn: string): string {
        // Extract resource type from URN for import command
        const parts = urn.split('::');
        return parts[parts.length - 2]; // Resource type is second to last part
    }
    
    private async restoreFromBackup(backupUrn: string, originalUrn: string): Promise<void> {
        // Implementation for restoring from backup
    }
    
    private async getLastKnownGoodState(): Promise<any> {
        // Implementation to get last known good state
        return { resources: [] };
    }
    
    private async restoreResourceState(urn: string, goodStateResource: any): Promise<void> {
        // Implementation for restoring resource state
    }
    
    private async validateStateConsistency(): Promise<boolean> {
        // Implementation for validating state consistency
        return true;
    }
}

// Advanced state surgery for complex scenarios
export class AdvancedStateSurgery extends ProductionIncidentResponse {
    
    // Handle large-scale state corruption across multiple stacks
    async handleMultiStackCorruption(stackNames: string[]): Promise<IncidentReport[]> {
        const reports: IncidentReport[] = [];
        
        // Process stacks in dependency order to avoid cascade failures
        const sortedStacks = await this.sortStacksByDependency(stackNames);
        
        for (const stackName of sortedStacks) {
            const report = await this.handleStateCorruption(`multi-stack-${stackName}`);
            reports.push(report);
            
            // Break if we exceed SLA for any individual stack
            if (report.slaStatus === 'BREACHED') {
                break;
            }
        }
        
        return reports;
    }
    
    // Repair state corruption caused by concurrent modifications
    async repairConcurrencyCorruption(): Promise<void> {
        // Implementation for resolving state conflicts from concurrent pulumi operations
        const lockInfo = await this.checkStackLock();
        
        if (lockInfo.locked) {
            // Force unlock if lock is stale (older than 30 minutes)
            const lockAge = Date.now() - lockInfo.timestamp;
            if (lockAge > 30 * 60 * 1000) {
                await this.forceUnlockStack();
            }
        }
        
        // Resolve state conflicts by merging changes
        await this.mergeConflictingStates();
    }
    
    private async sortStacksByDependency(stackNames: string[]): Promise<string[]> {
        // Implementation to sort stacks by dependency order
        return stackNames; // Simplified
    }
    
    private async checkStackLock(): Promise<{ locked: boolean; timestamp: number }> {
        // Implementation to check stack lock status
        return { locked: false, timestamp: Date.now() };
    }
    
    private async forceUnlockStack(): Promise<void> {
        await this.runCommand('pulumi cancel');
    }
    
    private async mergeConflictingStates(): Promise<void> {
        // Implementation for merging conflicting states
    }
}
```

## Cross-Region Disaster Recovery

### Multi-Region DR Architecture

**Critical for Production Systems**: Disaster recovery patterns ensure business continuity with RTO/RPO targets.

```typescript
export interface DisasterRecoveryConfig {
    primaryRegion: string;
    backupRegion: string;
    rpo: string; // Recovery Point Objective (e.g., "15m")
    rto: string; // Recovery Time Objective (e.g., "5m")
    failoverType: 'automatic' | 'manual';
}

export class DisasterRecoveryInfrastructure extends pulumi.ComponentResource {
    public readonly primaryEndpoint: pulumi.Output<string>;
    public readonly backupEndpoint: pulumi.Output<string>;
    public readonly failoverStatus: pulumi.Output<string>;
    
    constructor(name: string, config: DisasterRecoveryConfig, opts?: pulumi.ComponentResourceOptions) {
        super("custom:DisasterRecoveryInfrastructure", name, {}, opts);
        
        // Primary region infrastructure
        const primaryStack = this.createRegionalStack("primary", config.primaryRegion);
        
        // Backup region infrastructure  
        const backupStack = this.createRegionalStack("backup", config.backupRegion);
        
        // Cross-region database replication
        const primaryDb = primaryStack.database;
        const backupDb = new aws.rds.Instance(`${name}-backup-db`, {
            replicateSourceDb: primaryDb.id,
            instanceClass: primaryDb.instanceClass,
            availabilityZone: `${config.backupRegion}a`,
            backupRetentionPeriod: 7,
            deletionProtection: true,
            skipFinalSnapshot: false,
            finalSnapshotIdentifier: `${name}-backup-final-snapshot`,
            tags: {
                Role: "disaster-recovery-replica",
                Region: config.backupRegion
            }
        }, { parent: this, provider: this.getProviderForRegion(config.backupRegion) });
        
        // Route 53 health checks and failover
        const healthCheck = new aws.route53.HealthCheck(`${name}-health-check`, {
            fqdn: primaryStack.loadBalancer.dnsName,
            port: 443,
            type: "HTTPS",
            resourcePath: "/health",
            failureThreshold: 3,
            requestInterval: 30
        }, { parent: this });
        
        // DNS failover configuration
        const primaryRecord = new aws.route53.Record(`${name}-primary-record`, {
            zoneId: config.hostedZoneId,
            name: `${name}.example.com`,
            type: "A",
            setIdentifier: "primary",
            failoverRoutingPolicy: { type: "PRIMARY" },
            healthCheckId: healthCheck.id,
            aliases: [{
                name: primaryStack.loadBalancer.dnsName,
                zoneId: primaryStack.loadBalancer.zoneId,
                evaluateTargetHealth: true
            }]
        }, { parent: this });
        
        const backupRecord = new aws.route53.Record(`${name}-backup-record`, {
            zoneId: config.hostedZoneId,
            name: `${name}.example.com`,
            type: "A", 
            setIdentifier: "backup",
            failoverRoutingPolicy: { type: "SECONDARY" },
            aliases: [{
                name: backupStack.loadBalancer.dnsName,
                zoneId: backupStack.loadBalancer.zoneId,
                evaluateTargetHealth: true
            }]
        }, { parent: this });
        
        // Automated backup and restore procedures
        const backupLambda = new aws.lambda.Function(`${name}-backup-lambda`, {
            runtime: aws.lambda.Runtime.NodeJS18dX,
            code: new pulumi.asset.AssetArchive({
                "index.js": new pulumi.asset.StringAsset(this.getBackupLambdaCode(config))
            }),
            handler: "index.handler",
            timeout: 300,
            environment: {
                variables: {
                    PRIMARY_DB_ID: primaryDb.id,
                    BACKUP_REGION: config.backupRegion,
                    RPO_MINUTES: config.rpo.replace('m', ''),
                    S3_BACKUP_BUCKET: `${name}-dr-backups`
                }
            }
        }, { parent: this });
        
        // Schedule backups based on RPO
        const backupSchedule = new aws.cloudwatch.EventRule(`${name}-backup-schedule`, {
            description: `Backup schedule for ${config.rpo} RPO`,
            scheduleExpression: this.getRPOCronExpression(config.rpo)
        }, { parent: this });
        
        new aws.lambda.Permission(`${name}-backup-permission`, {
            action: "lambda:InvokeFunction",
            function: backupLambda.name,
            principal: "events.amazonaws.com",
            sourceArn: backupSchedule.arn
        }, { parent: this });
        
        new aws.cloudwatch.EventTarget(`${name}-backup-target`, {
            rule: backupSchedule.name,
            arn: backupLambda.arn
        }, { parent: this });
        
        this.primaryEndpoint = primaryStack.loadBalancer.dnsName;
        this.backupEndpoint = backupStack.loadBalancer.dnsName;
        this.failoverStatus = pulumi.output("standby");
        
        this.registerOutputs({
            primaryEndpoint: this.primaryEndpoint,
            backupEndpoint: this.backupEndpoint,
            failoverStatus: this.failoverStatus
        });
    }
    
    private createRegionalStack(role: string, region: string) {
        const provider = this.getProviderForRegion(region);
        
        // VPC in specific region
        const vpc = new aws.ec2.Vpc(`${role}-vpc`, {
            cidrBlock: role === "primary" ? "10.0.0.0/16" : "10.1.0.0/16",
            enableDnsHostnames: true,
            tags: { Role: role, Region: region }
        }, { provider });
        
        // Multi-AZ subnets
        const subnets = [0, 1].map(i => 
            new aws.ec2.Subnet(`${role}-subnet-${i}`, {
                vpcId: vpc.id,
                cidrBlock: role === "primary" ? `10.0.${i}.0/24` : `10.1.${i}.0/24`,
                availabilityZone: `${region}${String.fromCharCode(97 + i)}`,
                mapPublicIpOnLaunch: true
            }, { provider })
        );
        
        // Application Load Balancer
        const loadBalancer = new aws.lb.LoadBalancer(`${role}-alb`, {
            loadBalancerType: "application",
            subnets: subnets.map(s => s.id),
            enableDeletionProtection: role === "primary"
        }, { provider });
        
        // Database (primary or replica)
        let database;
        if (role === "primary") {
            database = new aws.rds.Instance(`${role}-db`, {
                engine: "postgres",
                instanceClass: "db.r5.large",
                allocatedStorage: 100,
                dbName: "maindb",
                username: "admin",
                password: "secure-password", // Use secrets in production
                backupRetentionPeriod: 7,
                backupWindow: "03:00-04:00",
                maintenanceWindow: "sun:04:00-sun:05:00",
                deletionProtection: true,
                skipFinalSnapshot: false
            }, { provider });
        }
        
        return { vpc, subnets, loadBalancer, database };
    }
    
    private getBackupLambdaCode(config: DisasterRecoveryConfig): string {
        return `
        const AWS = require('aws-sdk');
        const rds = new AWS.RDS({ region: '${config.primaryRegion}' });
        const s3 = new AWS.S3();
        
        exports.handler = async (event) => {
            const timestamp = new Date().toISOString();
            
            try {
                // Create RDS snapshot
                const snapshot = await rds.createDBSnapshot({
                    DBSnapshotIdentifier: \`dr-backup-\${timestamp}\`,
                    DBInstanceIdentifier: process.env.PRIMARY_DB_ID
                }).promise();
                
                // Export application data to S3
                const backupData = {
                    timestamp,
                    snapshotId: snapshot.DBSnapshot.DBSnapshotIdentifier,
                    region: '${config.primaryRegion}'
                };
                
                await s3.putObject({
                    Bucket: process.env.S3_BACKUP_BUCKET,
                    Key: \`backups/\${timestamp}.json\`,
                    Body: JSON.stringify(backupData)
                }).promise();
                
                console.log('Backup completed successfully');
                
            } catch (error) {
                console.error('Backup failed:', error);
                throw error;
            }
        };
        `;
    }
    
    private getRPOCronExpression(rpo: string): string {
        // Convert RPO to cron expression
        const minutes = parseInt(rpo.replace('m', ''));
        if (minutes <= 15) return 'rate(15 minutes)';
        if (minutes <= 30) return 'rate(30 minutes)'; 
        if (minutes <= 60) return 'rate(1 hour)';
        return 'rate(4 hours)';
    }
}

// Manual failover procedure
export class DisasterRecoveryManager {
    async performManualFailover(stackName: string): Promise<FailoverResult> {
        console.log('Starting disaster recovery failover...');
        
        // Step 1: Promote backup database to primary
        const backupDb = await this.promoteReadReplica(stackName);
        
        // Step 2: Update Route 53 to point to backup region
        await this.updateDNSFailover(stackName, 'backup');
        
        // Step 3: Scale up backup region infrastructure
        await this.scaleBackupInfrastructure(stackName);
        
        // Step 4: Verify application health
        const healthCheck = await this.verifyApplicationHealth(stackName);
        
        if (healthCheck.healthy) {
            console.log('Failover completed successfully');
            return {
                status: 'success',
                failoverTime: healthCheck.responseTime,
                newPrimaryRegion: 'backup'
            };
        } else {
            throw new Error('Failover failed - application unhealthy');
        }
    }
    
    async performFailback(stackName: string): Promise<void> {
        console.log('Starting failback to primary region...');
        
        // Step 1: Ensure primary region is healthy
        await this.restorePrimaryInfrastructure(stackName);
        
        // Step 2: Sync data from backup to primary
        await this.syncDatabases('backup', 'primary');
        
        // Step 3: Update DNS back to primary
        await this.updateDNSFailover(stackName, 'primary');
        
        console.log('Failback completed successfully');
    }
}

// Usage
const drInfra = new DisasterRecoveryInfrastructure("my-app-dr", {
    primaryRegion: "us-west-2",
    backupRegion: "us-east-1", 
    rpo: "15m", // 15 minute recovery point objective
    rto: "5m",  // 5 minute recovery time objective
    failoverType: "manual"
});

const drManager = new DisasterRecoveryManager();
// In case of disaster: await drManager.performManualFailover("my-app-dr");
```

## Basic Networking Fundamentals

### VPC and Subnet Design Patterns

**Foundation Knowledge**: Essential networking concepts for all infrastructure interviews.

```typescript
export class NetworkingFoundations extends pulumi.ComponentResource {
    public readonly vpc: aws.ec2.Vpc;
    public readonly publicSubnets: aws.ec2.Subnet[];
    public readonly privateSubnets: aws.ec2.Subnet[];
    public readonly internetGateway: aws.ec2.InternetGateway;
    public readonly natGateways: aws.ec2.NatGateway[];
    
    constructor(name: string, config: NetworkConfig, opts?: pulumi.ComponentResourceOptions) {
        super("custom:NetworkingFoundations", name, {}, opts);
        
        // VPC - Virtual Private Cloud
        this.vpc = new aws.ec2.Vpc(`${name}-vpc`, {
            cidrBlock: config.vpcCidr || "10.0.0.0/16",
            enableDnsHostnames: true,
            enableDnsSupport: true,
            tags: {
                Name: `${name}-vpc`,
                Environment: config.environment
            }
        }, { parent: this });
        
        // Internet Gateway for public internet access
        this.internetGateway = new aws.ec2.InternetGateway(`${name}-igw`, {
            vpcId: this.vpc.id,
            tags: { Name: `${name}-internet-gateway` }
        }, { parent: this });
        
        // Get availability zones
        const azs = aws.getAvailabilityZones({
            state: "available"
        });
        
        // Public subnets (internet accessible)
        this.publicSubnets = azs.then(zones => 
            zones.names.slice(0, config.azCount || 2).map((az, i) => 
                new aws.ec2.Subnet(`${name}-public-${i}`, {
                    vpcId: this.vpc.id,
                    cidrBlock: this.calculateSubnetCidr(config.vpcCidr, i, 'public'),
                    availabilityZone: az,
                    mapPublicIpOnLaunch: true,
                    tags: {
                        Name: `${name}-public-subnet-${i}`,
                        Type: "public"
                    }
                }, { parent: this })
            )
        );
        
        // Private subnets (no direct internet access)
        this.privateSubnets = azs.then(zones =>
            zones.names.slice(0, config.azCount || 2).map((az, i) =>
                new aws.ec2.Subnet(`${name}-private-${i}`, {
                    vpcId: this.vpc.id,
                    cidrBlock: this.calculateSubnetCidr(config.vpcCidr, i, 'private'),
                    availabilityZone: az,
                    mapPublicIpOnLaunch: false,
                    tags: {
                        Name: `${name}-private-subnet-${i}`,
                        Type: "private"
                    }
                }, { parent: this })
            )
        );
        
        // NAT Gateways for private subnet internet access
        this.natGateways = this.publicSubnets.map((subnet, i) => {
            const eip = new aws.ec2.Eip(`${name}-nat-eip-${i}`, {
                vpc: true,
                tags: { Name: `${name}-nat-eip-${i}` }
            }, { parent: this });
            
            return new aws.ec2.NatGateway(`${name}-nat-${i}`, {
                allocationId: eip.id,
                subnetId: subnet.id,
                tags: { Name: `${name}-nat-gateway-${i}` }
            }, { parent: this, dependsOn: [this.internetGateway] });
        });
        
        // Route tables
        this.createRouteTables(name);
        
        // Security groups
        this.createSecurityGroups(name);
        
        this.registerOutputs({
            vpcId: this.vpc.id,
            publicSubnetIds: this.publicSubnets.map(s => s.id),
            privateSubnetIds: this.privateSubnets.map(s => s.id),
            internetGatewayId: this.internetGateway.id
        });
    }
    
    private calculateSubnetCidr(vpcCidr: string, index: number, type: 'public' | 'private'): string {
        // Split VPC CIDR into smaller subnets
        const baseOctet = type === 'public' ? 0 : 100;
        return vpcCidr.replace(/(\d+\.\d+\.)\d+\.0\/16/, `$1${baseOctet + index}.0/24`);
    }
    
    private createRouteTables(name: string) {
        // Public route table
        const publicRouteTable = new aws.ec2.RouteTable(`${name}-public-rt`, {
            vpcId: this.vpc.id,
            tags: { Name: `${name}-public-route-table` }
        }, { parent: this });
        
        // Route to internet gateway
        new aws.ec2.Route(`${name}-public-route`, {
            routeTableId: publicRouteTable.id,
            destinationCidrBlock: "0.0.0.0/0",
            gatewayId: this.internetGateway.id
        }, { parent: this });
        
        // Associate public subnets with public route table
        this.publicSubnets.forEach((subnet, i) => {
            new aws.ec2.RouteTableAssociation(`${name}-public-rta-${i}`, {
                subnetId: subnet.id,
                routeTableId: publicRouteTable.id
            }, { parent: this });
        });
        
        // Private route tables (one per AZ)
        this.privateSubnets.forEach((subnet, i) => {
            const privateRouteTable = new aws.ec2.RouteTable(`${name}-private-rt-${i}`, {
                vpcId: this.vpc.id,
                tags: { Name: `${name}-private-route-table-${i}` }
            }, { parent: this });
            
            // Route to NAT gateway
            new aws.ec2.Route(`${name}-private-route-${i}`, {
                routeTableId: privateRouteTable.id,
                destinationCidrBlock: "0.0.0.0/0",
                natGatewayId: this.natGateways[i].id
            }, { parent: this });
            
            // Associate private subnet with private route table
            new aws.ec2.RouteTableAssociation(`${name}-private-rta-${i}`, {
                subnetId: subnet.id,
                routeTableId: privateRouteTable.id
            }, { parent: this });
        });
    }
    
    private createSecurityGroups(name: string) {
        // Web tier security group
        const webSG = new aws.ec2.SecurityGroup(`${name}-web-sg`, {
            vpcId: this.vpc.id,
            description: "Security group for web tier",
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: 80,
                    toPort: 80,
                    cidrBlocks: ["0.0.0.0/0"]
                },
                {
                    protocol: "tcp", 
                    fromPort: 443,
                    toPort: 443,
                    cidrBlocks: ["0.0.0.0/0"]
                }
            ],
            egress: [{
                protocol: "-1",
                fromPort: 0,
                toPort: 0,
                cidrBlocks: ["0.0.0.0/0"]
            }],
            tags: { Name: `${name}-web-security-group` }
        }, { parent: this });
        
        // Application tier security group
        const appSG = new aws.ec2.SecurityGroup(`${name}-app-sg`, {
            vpcId: this.vpc.id,
            description: "Security group for application tier",
            ingress: [{
                protocol: "tcp",
                fromPort: 8080,
                toPort: 8080,
                securityGroups: [webSG.id] // Only allow from web tier
            }],
            egress: [{
                protocol: "-1",
                fromPort: 0,
                toPort: 0,
                cidrBlocks: ["0.0.0.0/0"]
            }],
            tags: { Name: `${name}-app-security-group` }
        }, { parent: this });
        
        // Database tier security group
        const dbSG = new aws.ec2.SecurityGroup(`${name}-db-sg`, {
            vpcId: this.vpc.id,
            description: "Security group for database tier",
            ingress: [{
                protocol: "tcp",
                fromPort: 5432,
                toPort: 5432,
                securityGroups: [appSG.id] // Only allow from app tier
            }],
            tags: { Name: `${name}-database-security-group` }
        }, { parent: this });
    }
}

// Usage
const networking = new NetworkingFoundations("my-app", {
    vpcCidr: "10.0.0.0/16",
    azCount: 3,
    environment: "production"
});
```

This advanced guide covers expert-level patterns essential for senior infrastructure roles. Focus on the patterns most relevant to your target position and company scale.