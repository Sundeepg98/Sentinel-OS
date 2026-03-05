# Sentinel-OS 🛡️

[![Sentinel-OS CI](https://github.com/Sundeepg98/Sentinel-OS/actions/workflows/ci.yml/badge.svg)](https://github.com/Sundeepg98/Sentinel-OS/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Staff-Level Intelligence](https://img.shields.io/badge/Architecture-Staff--Level-indigo.svg)](https://github.com/Sundeepg98/Sentinel-OS)

Sentinel-OS is an **Industrial-Grade Technical Intelligence Dashboard** designed for Staff+ Engineer preparation. It transforms plain technical dossiers into a secure, multi-tenant "Operating System" featuring RAG-powered AI drills, 3D architectural mapping, and real-time knowledge hot-reloading.

![Project Preview](.playwright-mcp/page-2026-03-05T08-02-44-141Z.png)

## 🏗️ Architectural Foundations

Sentinel-OS is built on four core engineering pillars:

### 1. Intelligence Harvester (RAG)
- **Worker Thread Isolation**: All Markdown parsing and 3072-D vectorization is offloaded to background threads to ensure 0ms main-thread latency.
- **Dual-Engine Persistence**: High-speed **SQLite** for local development and **Managed PostgreSQL (pgvector)** for production stability.
- **Hot-Reloading**: Real-time filesystem monitoring via `chokidar` for zero-restart knowledge updates.

### 2. Neural Impact Simulator (Phase 4)
- **3D Blast Radius Analysis**: Simulate architectural failures in 3D space. Click any node to visualize the cascading ripple effect across your infrastructure.
- **Recursive BFS Traversal**: Calculates dependency impact at three levels: Critical (Red), Major (Orange), and Warning (Yellow).
- **Directional Particle Flow**: Inverse physics vectors visually simulate alarm propagation from the failure origin.

### 3. Multi-Tenant Lockdown
- **Clerk Auth**: Secure JWT-based identity management.
- **User Scoping**: Every score, whiteboard session, and learned asset is cryptographically scoped to the specific user ID in PostgreSQL.
- **Developer Bypass**: A dedicated `x-sentinel-bypass` header for high-velocity local testing.

### 4. Protocol & Reliability
- **Strict API Contract**: Standardized `{ status, data, meta }` envelopes for 100% predictable data fetching.
- **Industrial Quality Gates**: Pre-commit Husky hooks enforcing ESLint, Prettier, and TypeScript strictness.
- **Full-Stack Observability**: Backend pino logs synchronized with Frontend Error Telemetry.

## 🛠️ Tech Stack
- **Frontend**: React 19, TypeScript, TanStack Query, Framer Motion, Three.js (react-force-graph).
- **Backend**: Express 5 (v1 API), Node.js Worker Threads, pgvector, FlexSearch.
- **Infrastructure**: Render (Auto-Deploy), GitHub Actions (CI/CD), Docker-ready.

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
   npm run test # Runs both Backend Unit Tests (Jest) and Frontend E2E (Playwright)
   npm run build # Validates TypeScript and generates Rollup Visualizer report
   ```

## 📁 Repository Structure
- `/src`: Glassmorphic Technical Shell (React).
- `/server`: Sentinel Harvester & API v1 (Node.js).
- `/intelligence`: Technical Database (Markdown).
- `/tests`: Playwright E2E Suite.
- `/server/tests`: Jest Unit Tests.

---
*Built for Architects by Sentinel | Optimized for L6+ Infrastructure & Systems Engineering Preps.*
