---
label: "Distributed Infrastructure"
type: "markdown"
icon: "Server"
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
