# Sentinel-OS 🛡️

Sentinel-OS is an **Industrial-Grade Technical Intelligence Dashboard** designed for Staff+ Engineer preparation. It transforms plain technical dossiers into a secure, multi-tenant "Operating System" featuring RAG-powered AI drills, 3D architectural mapping, and real-time knowledge hot-reloading.

![Project Preview](.playwright-mcp/page-2026-03-03T07-38-40-906Z.png)

## 🏗️ Architectural Foundations

Sentinel-OS is built on four core engineering pillars:

### 1. Intelligence Harvester (RAG)
- **Worker Thread Isolation**: All Markdown parsing and 3072-D vectorization is offloaded to background threads to ensure 0ms main-thread latency.
- **SQLite Vector Store**: Persistent local RAG engine with semantic AST chunking to protect code block integrity.
- **Hot-Reloading**: Real-time filesystem monitoring via `chokidar` for zero-restart knowledge updates.

### 2. Multi-Tenant Lockdown
- **Clerk Auth**: Secure JWT-based identity management.
- **User Scoping**: Every score, whiteboard session, and learned asset is cryptographically scoped to the specific user ID in SQLite.
- **Developer Bypass**: A dedicated `x-sentinel-bypass` header for high-velocity local testing.

### 3. Protocol & Reliability
- **Strict JSON Schemas**: AI responses enforced at the protocol level using Gemini SDK's `responseSchema`.
- **Zod Validation**: Strict network boundary validation for all incoming API payloads.
- **Circuit Breaking**: Upstream rate-limiting to protect API quotas.

### 4. Cinematic UX
- **React Query**: Industrial state management with automatic caching and deduplication.
- **3D Neural Graph**: Interactive D3-Force-3D map of technical concepts and cross-dossier links.
- **Fault Tolerance**: Global React Error Boundaries and professional Toast telemetry.

## 🛠️ Tech Stack
- **Frontend**: React 19, TypeScript, TanStack Query, Framer Motion, Three.js.
- **Backend**: Express 5 (v1 API), Node.js Worker Threads, better-sqlite3, FlexSearch.
- **Infrastructure**: Render (Auto-Deploy), GitHub Actions (CI/CD), Husky (Pre-commit hooks).

## 🚀 Getting Started

1. **Environment Setup**:
   ```bash
   cp .env.example .env.local
   # Fill in your GEMINI_API_KEY and CLERK_SECRET_KEY
   ```

2. **Installation**:
   ```bash
   npm install
   ```

3. **Development**:
   ```bash
   npm run dev
   ```

4. **Industrial Quality Gates**:
   ```bash
   npm run test # Runs both Backend Unit Tests and Playwright E2E
   npm run build # Validates TypeScript and generates Rollup Visualizer report
   ```

## 📁 Repository Structure
- `/src`: Glassmorphic Technical Shell (React).
- `/server`: Sentinel Harvester & API v1 (Node.js).
- `/intelligence`: Technical Database (Markdown).
- `/server/migrations`: Versioned SQL schema evolution.

---
*Built for Architects by Sentinel | Optimized for L6+ Infrastructure & Systems Engineering Preps.*
