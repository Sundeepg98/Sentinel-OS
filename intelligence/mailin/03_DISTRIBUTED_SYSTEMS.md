---
label: Distributed Infrastructure
type: map
icon: Layers
data:
  - id: exactly_once
    title: Exactly-Once Processing
    tech: Idempotency Keys + Optimistic Locking
    bottleneck: Duplicate Dispatches
    scenario: Network partitions causing redelivery in brokers (Kafka/RabbitMQ).
    code: |
      # Atomic execution flow
      if (redis.setnx(idempotency_key, "locked", ttl=24h)) {
        dispatch_email()
      } else {
        skip_duplicate()
      }
  - id: grpc_kubernetes
    title: gRPC Load Balancing
    tech: K8s Headless Services + mTLS
    bottleneck: Sticky L4 TCP Connections
    scenario: persistent HTTP/2 sockets causing pod hotspots in Kubernetes.
    code: |
      # Layer 7 (Request-Level) Balancing
      - Use Headless Services (clusterIP: None)
      - Round-robin client-side balancing
      - Tuning MAX_CONNECTION_AGE
  - id: zero_trust
    title: Zero-Trust Security
    tech: Linkerd / Envoy Sidecars
    bottleneck: Perimeter-based Trust
    scenario: enforcing workload identity via mTLS sidecar proxies.
    code: |
      # Service Mesh Benefits
      - Transparent L7 load balancing
      - EWMA latency-aware routing
      - Automated mTLS encryption
---

# Microservices Orchestration & Architecture

Mailin relies on modern distributed patterns to process half a billion emails monthly with absolute consistency.

## Message Integrity
- **leaf Services**: Specialized microservices interfacing with single data systems (PostgreSQL) to enforce exactly-once guarantees.
- **Orchestrator Services**: Coordinate overarching workflows (scheduling, formatting) without managing state consistency.

## Internal Communication
Relies heavily on **gRPC** over HTTP/2.
- **Binary Serialization**: uses Protocol Buffers (protobuf) to reduce memory overhead and parsing latency compared to REST/JSON.
- **Sidecar Proxies**: use Linkerd to perform request-level load balancing across the pod array transparently.
