# Contributing to Sentinel-OS 🛡️

We welcome contributions from technical architects and infrastructure engineers. Please follow these guidelines to ensure the platform maintains its industrial-grade stability.

## 🛠️ Development Workflow

1. **Environment Setup**:
   - Copy `.env.example` to `.env.local`.
   - Ensure `npm run dev:windows` (for Windows) or `npm run dev` starts the full stack.
   - Run `npm run verify` to check health across all 3 tiers.

2. **Code Standards**:
   - **TypeScript**: No `any` types allowed. Use absolute imports (`@/*`).
   - **Linting**: `npm run lint` is mandatory.
   - **Formatting**: `prettier` is enforced on commit.

3. **Database & Persistence**:
   - If you change the schema, update `server/migrations/001_base_schema.sql`.
   - Run `npm run backup` before major migrations.

4. **Testing**:
   - New features require a Playwright E2E test in `/tests`.
   - Frontend components require a Vitest unit test in `src/**/*.test.tsx`.
   - Backend logic requires a Jest unit test in `server/tests/`.

## 📜 Commit Messages

We follow conventional commits:
- `feat:` for new features (e.g., `feat: add AI-powered bottleneck detection`).
- `fix:` for bug fixes.
- `refactor:` for code changes that neither fix a bug nor add a feature.
- `infra:` for DevOps/Deployment changes.

## 🚀 Pull Requests

- Ensure the CI pipeline (GitHub Actions) passes.
- Include a screenshot of the UI if the change is visual.
- Link any relevant issues or technical dossiers.

---
*Built for Architects by Architects.*
