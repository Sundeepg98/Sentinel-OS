---
label: IaC & Pulumi Orchestration
type: map
icon: Layers
data:
  - id: stack_references
    title: Stack Orchestration
    tech: Pulumi StackReferences
    bottleneck: Cross-Stack Coupling
    scenario: Managing dependencies between networking, data, and app stacks safely.
    code: |
      # Consuming outputs from another stack
      const netStack = new pulumi.StackReference("org/networking/prod");
      const vpcId = netStack.getOutput("vpcId");
  - id: state_locking
    title: State Locking & Concurrency
    tech: Pulumi Service / S3 Backend
    bottleneck: Concurrent Stack Updates
    scenario: Preventing resource corruption when multiple CI/CD pipelines trigger simultaneously.
    code: |
      # Logic: Ensure atomic state acquisition
      if (backend.isLocked(stack)) {
        retry_with_exponential_backoff()
      } else {
        acquire_lease()
      }
  - id: component_resources
    title: Abstracted Components
    tech: Pulumi ComponentResources
    bottleneck: Infrastructure Drifting
    scenario: Encapsulating complex AWS patterns into reusable, versioned team libraries.
    code: |
      export class SecureBucket extends pulumi.ComponentResource {
        constructor(name, args) {
          super("pkg:SecureBucket", name, args);
          // Logic: Enforce encryption and public access blocks
        }
      }
---

# Advanced Infrastructure as Code (IaC)

Infrastructure management for high-growth clients requires moving beyond simple resource scripts toward fully orchestrated, componentized systems.

## Orchestration Strategy
- **Micro-Stacks**: Breaking large monolithic stacks into granular units (Networking, Database, K8s) to minimize blast radius.
- **Dynamic Providers**: Programmatically configuring multi-region AWS providers for global workload isolation.
