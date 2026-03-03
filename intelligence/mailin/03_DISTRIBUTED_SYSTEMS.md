---
label: Distributed Consistency & gRPC
type: map
icon: Layers
data:
  - id: exactly_once
    title: Exactly-Once Processing
    tech: Idempotency Keys + Optimistic Locking
    bottleneck: Duplicate Dispatches
    scenario: Network partitions causing message redelivery in Kafka/RabbitMQ.
    code: |
      # Atomic execution flow
      if (redis.setnx(idempotency_key, "processing", ttl=24h)) {
        process_email()
      } else {
        discard_duplicate()
      }
  - id: grpc_lb
    title: gRPC L7 Load Balancing
    tech: K8s Headless Services + Linkerd
    bottleneck: Long-lived TCP Sticky Connections
    scenario: gRPC multiplexing requests over one socket, causing pod hotspots.
    code: |
      # Kubernetes Headless Service
      clusterIP: None
      # Client-side round-robin
      grpc.lb_policy = "round_robin"
      grpc.max_connection_age_ms = 30000
---

# Microservices Orchestration & State Integrity

Maintaining state integrity across a highly concurrent distributed infrastructure requires rigorous architectural patterns.

## Exactly-Once Processing
Achieving this requires solving reliable message delivery and singular processing. Mailin uses at-least-once delivery (Kafka) paired with destination-side idempotency to guarantee emails are sent only once.

## Zero-Trust gRPC
Communication relies on gRPC over HTTP/2, reducing memory overhead and parsing latency. Security is enforced via mutual TLS (mTLS) utilizing service mesh sidecar proxies (Linkerd/Envoy).
