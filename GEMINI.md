# Engineering Standards for Sentinel-OS 🛡️

This document outlines the foundational engineering mandates for this repository.

## 1. Local-First Verification
NEVER push code to the `main` branch without first empirically verifying the change in the local development environment using the Playwright MCP. 

## 2. Model Standard
- **Generation**: `gemini-2.5-flash` or `gemini-pro`.
- **Embeddings**: `gemini-embedding-001` (3072-dimensional).

## 3. Data Integrity
- All technical dossiers must follow the `label`, `type`, `icon` frontmatter standard.
- User-specific state (scores, whiteboard) must be scoped to the `userId` in PostgreSQL.

## 4. Quality Gates
- **Husky**: Pre-commit hooks are mandatory.
- **ESLint**: Zero errors allowed in `main`.
- **Testing**: 100% pass rate required for PR merges.

---
*Built for Architects.*
