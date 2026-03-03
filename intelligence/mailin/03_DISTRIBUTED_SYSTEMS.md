---
label: Distributed Systems & K8s
type: map
icon: Layers
data:
  - id: exactly_once
    title: Exactly-Once Processing
    tech: Idempotency Keys + Optimistic Locking
    bottleneck: Duplicate Dispatches
    scenario: Ensuring state integrity across high-concurrency microservices.
    code: |
      # Atomic execution flow
      - Generate cryptographically unique keys
      - Database status check (Optimistic Locking)
      - Leaf Service execution
  - id: grpc_lb
    title: gRPC Load Balancing
    tech: K8s Headless Services + mTLS
    bottleneck: Persistent L4 Sticky Connections
    scenario: gRPC multiplexing requests over a single socket, causing backend pod hotspots.
    code: |
      # Layer 7 (Request-Level) Balancing
      - Use Kubernetes Headless Services (clusterIP: None)
      - round_robin load balancing policy
      - Configure MAX_CONNECTION_AGE
  - id: zero_trust
    title: Zero-Trust Orchestration
    tech: Linkerd / Envoy Sidecars
    bottleneck: Perimeter-based Trust
    scenario: Identifying workloads intrinsically via mutual TLS rather than IP perimeters.
    code: |
      # Service Mesh Benefits
      - Transparent L7 load balancing
      - EWMA latency-aware routing
      - Automatic mTLS enforcement
---

# Microservices Orchestration & gRPC

Maintaining state integrity across a highly concurrent distributed infrastructure requires rigorous architectural patterns.

## Exactly-Once Processing
Achieving this mandates solving reliable message delivery and guaranteed singular processing. Mailin uses at-least-once delivery (Kafka/RabbitMQ) paired with destination-side idempotency.

## The gRPC Conundrum
Default Kubernetes ClusterIP (Layer 4) load balancing fails for gRPC because it establishes long-lived TCP connections. Requests are stuck on a single pod. Mailin resolves this by shifting to Layer 7 (Request-level) balancing via Headless Services or Service Meshes.
