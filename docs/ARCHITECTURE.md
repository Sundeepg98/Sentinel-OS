# Sentinel-OS: System Architecture 🛡️

## Overview
Sentinel-OS is a high-stakes technical intelligence command center designed for Staff+ engineering preparation. It combines a real-time RAG (Retrieval-Augmented Generation) engine with 3D architectural failure simulations and multi-tier cloud persistence.

## 🏗️ Core Architectural Layers

### 1. The RAG Ingestion Pipeline (Harvester)
- **Engine**: Parallel batch processing with throttled concurrency (`p-limit`).
- **Isolation**: Ingestion runs in a dedicated **Node.js Worker Thread** to prevent the main event loop from blocking during heavy embedding calculations.
- **Persistence**: Hybrid SQLite/Postgres bridge. Uses MD5 content hashing to skip redundant processing.
- **Atomic Integrity**: All re-indexing operations are wrapped in SQL transactions (`BEGIN/COMMIT`) to prevent data corruption.

### 2. 3D Architectural Nervous System
- **Visualization**: React-Force-Graph-3D powered by Three.js.
- **Neural Impacts**: Recursive BFS (Breadth-First Search) algorithm calculates the blast radius of systemic failures.
- **Physics**: Custom inverse-contagion particle physics visualize risk propagation away from failure origins.

### 3. Persistence & Environment Mirroring
- **3-Tier Lifecycle**: Local (Development), Staging (Neon/Render), and Production (Render).
- **Dual-Engine DB**:
  - **Local**: SQLite + `sqlite-vec` (zero-config, high speed).
  - **Cloud**: Managed PostgreSQL + `pgvector` (stateless persistence).
- **Parity**: A custom migration bridge ensures that `server/migrations/*.sql` files are applied consistently across both SQLite and Postgres syntax.

### 4. Security & Resilience
- **Auth**: Multi-tier authentication (Clerk JWT + Sentinel Bypass Header).
- **Hardening**:
  - **Network**: Strict CORS, CSP, HPP, and 1MB Payload limiting.
  - **API**: Full Zod schema validation for Body, Query, and Path parameters.
  - **Resilience**: AI Engine Circuit Breaker + Layer 2 LRU Cache for response memoization.

## 🛰️ Network Topology
- **Handshake**: Full-stack traceability via `X-Correlation-ID` handshake.
- **Telemetry**: Deep resource health probes (RSS Memory, Uptime, Worker Pulse).
- **Observability**: Centralized structured logging (`pino`) with automated secret redaction.

---
*Last Updated: March 2026 | Built for Architects.*
