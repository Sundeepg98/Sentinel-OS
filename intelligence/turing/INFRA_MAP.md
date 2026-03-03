---
label: Infra Architecture Map
type: map
icon: Network
data:
  - id: idempotency
    title: Distributed Idempotency
    tech: Redis + Unique Keys
    bottleneck: Duplicate API Retries
    scenario: Retries from clients causing multiple resource creations.
    code: |
      // Pulumi + Cloudflare Workers Pattern
      const idempotencyKey = request.headers.get("X-Idempotency-Key");
      const exists = await redis.get(idempotencyKey);
      if (exists) return JSON.parse(exists);
  - id: sharding
    title: Horizontal Sharding
    tech: Postgres + Citus
    bottleneck: Single Leader Write Contention
    scenario: Massive write volume hitting CPU limits on primary DB.
    code: |
      -- Pulumi Resource Definition
      const cluster = new aws.rds.Cluster("sharded-db", {
        engine: "aurora-postgresql",
        instances: 3
      });
---

# Infrastructure Architecture Patterns
This module visualizes critical distributed patterns managed via Pulumi.
