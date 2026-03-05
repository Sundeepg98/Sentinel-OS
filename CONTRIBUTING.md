# Contributing to Sentinel-OS 🛡️

We welcome contributions from technical architects and infrastructure engineers. Please follow these guidelines to ensure the platform maintains its industrial-grade stability.

## 🛠️ Development Workflow

1. **Environment Setup**:
   - Copy `.env.example` to `.env.local`.
   - Ensure `npm run dev` starts both the Vite frontend and Node.js backend.

2. **Code Standards**:
   - **TypeScript**: No `any` types allowed in new contributions. Use strict typing.
   - **Linting**: Run `npm run lint` before committing.
   - **Formatting**: Prettier is enforced via Husky hooks.

3. **Database Migrations**:
   - If you change the SQLite schema, add a new `.sql` file to `server/migrations/`.
   - Ensure you also update `server/lib/db-postgres.js` for cloud parity.

4. **Testing**:
   - New features must include a Playwright E2E test in `/tests`.
   - Backend logic must include a Jest unit test in `/server/tests`.

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
