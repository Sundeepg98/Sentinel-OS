---
label: Distributed Cloud Architecture
type: map
icon: Globe
data:
  - id: horizontal_sharding
    title: Database Sharding
    tech: Postgres + Citus / Vitess
    bottleneck: Single-Leader Write Contention
    scenario: Scaling global telemetry ingestion without hitting the IOPS ceiling.
    code: |
      -- Distribute table by hash of tenant_id
      SELECT create_distributed_table('telemetry', 'tenant_id');
  - id: cloud_idempotency
    title: Distributed Idempotency
    tech: Redis + X-Request-ID
    bottleneck: Duplicate API Retries
    scenario: Ensuring a resource creation request is only executed once across a microservices mesh.
    code: |
      # Check Redis for request key
      key = `idmp:${request_id}`
      if (redis.set(key, "running", nx, ex=3600)) {
        process_request()
      }
  - id: circuit_breaking
    title: Resilience Patterns
    tech: Envoy / Hystrix Logic
    bottleneck: Cascading Failures
    scenario: Stopping a failing downstream service from taking down the entire API gateway.
    code: |
      # Trip breaker if fail rate > 50%
      if (window.errorRate > 0.5) {
        gateway.halt(service_id)
        start_cooldown_period(30s)
      }
---

# High-Scale System Design

Turing clients often demand systems capable of 100k+ RPS with sub-100ms latency.

## Key Reliability Metrics
- **Mean Time to Recovery (MTTR)**: Focus on rapid rollback strategies using IaC versioning.
- **Consistency Models**: Evaluating Eventual vs Strong consistency based on the specific domain (e.g., User Profile vs. Billing).
