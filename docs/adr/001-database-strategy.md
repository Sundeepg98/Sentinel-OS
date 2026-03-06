# ADR 001: Distributed Database Strategy

## Status
Accepted

## Context
Sentinel-OS requires vector search capabilities (RAG) and persistent user state (history, scores). 
Local development needs to be fast and zero-config, while production must be resilient across ephemeral server restarts (Render).

## Decision
We implement a **Dual-Engine Persistence Layer**:
1. **Local**: SQLite with the `sqlite-vec` extension.
2. **Cloud (Staging/Production)**: Managed PostgreSQL with the `pgvector` extension.

## Consequences
- **Dev-Prod Parity**: We maintain schema parity across different engines using a custom migration bridge.
- **Latency**: Local runs have 0ms DB latency. Production uses connection pooling to mitigate cloud latency.
- **Cost**: Both engines remain within the free tier of respective providers (Render/Neon).
