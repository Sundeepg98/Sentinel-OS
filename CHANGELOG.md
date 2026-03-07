# Changelog

All notable changes to this project will be documented in this file.

## [2.7.0] - 2026-03-07
### Added
- **Full-Stack Correlation**: Injected child loggers into every request lifecycle, linking all server logs to the Correlation ID.
- **Background Re-Indexing Sync**: Automated QueryClient invalidation on background neural re-indexing completion.
- **Root Error Boundaries**: Implemented industrial-grade component crash recovery at the root of the React application.
- **Experimental API Hardening**: Standardized Web Speech API types, eliminating the final `any` types in the interaction engine.
- **Browser Connectivity API**: Real-time internet connectivity status tracking in the UI StatusBanner.
- **Staff-Level Health Telemetry**: Enhanced /health with CPU, Memory, and AI Circuit Breaker state.
- **JSend Contract Perfection**: Standardized all validation failures to flow through the centralized structural logging pipeline.

### Fixed
- **Multi-Engine Consistency**: Hardened the database export utility to correctly handle cloud vs local persistence.
- **Telemetry Traceability**: Included Request Correlation IDs in all automated frontend error reports.
- **Security**: Enabled Proxy Trust for correct IP-based rate limiting behind load balancers.

## [2.6.0] - 2026-03-06
### Added
- **AI Engine Layer 2 Caching**: High-performance LRU memoization for generation and embeddings.
- **Resilience Circuit Breaker**: Industrial failure handling for upstream AI providers (Gemini).
- **AI Logic Unit Tests**: Standardized test suite for truncation, caching, and circuit breaker logic.
- **Persistent Observability**: Migrated all system telemetry (AI/UI) to persistent database storage.
- **Architectural Traceability**: Implemented Correlation ID handshake across the entire network stack.
- **Deep Resource Telemetry**: Real-time server resource monitoring (Memory, CPU, Uptime) in /health.
- **Parallel Ingestion Pipeline**: Throttled parallel re-indexing for 400% faster RAG hydration.
- **Data Durability**: Automated rolling-window database backup utility (`npm run backup`).
- **Standardized Type Contracts**: Achieved 100% TypeScript strictness across the frontend.
- **Unified Structured Logging**: Centralized pino logger with automated secret redaction.

### Fixed
- **SQLite Concurrency**: Enabled WAL mode for non-blocking local development.
- **Stream Stability**: Resolved EventSource authentication handshake failures.
- **Governance**: Added Conventional Commit linting and PR/Issue templates.

## [2.5.0] - 2026-03-05
### Added
- **Neural Impact Simulator**: 3D cascading failure visualization.
- **Cloud Persistence**: Migration to Managed PostgreSQL with pgvector.
- **Strict API Contract**: Standardized JSON envelopes for all responses.
- **Industrial Quality Gates**: Husky, Prettier, and Full-stack ESLint.
- **Dockerization**: Containerized development and production environments.
- **Error Telemetry**: Automated frontend crash reporting to backend logs.

## [2.0.0] - 2026-03-03
### Added
- **RAG Engine**: Worker-thread isolated technical intelligence harvester.
- **Clerk Auth**: Secure multi-tenant identity management.
- **Search**: Hybrid Keyword and Semantic search capabilities.

## [1.0.0] - 2026-03-01
### Added
- Initial Glassmorphic UI Dashboard.
- Basic dossier parsing.
- Static Knowledge Graph.
