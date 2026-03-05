# Clerk Authentication Setup 🔐

Sentinel-OS is now configured for Clerk Multi-Tenant Authentication. To enable it, follow these steps:

### 1. Obtain Clerk Keys
1. Go to [Clerk.com](https://clerk.com) and create a new project.
2. In the "API Keys" section, copy your **Publishable Key** and **Secret Key**.

### 2. Configure Environment Variables
Add the following keys to your `.env` (local) and Render Dashboard (production):

| Key | Value |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_...` (from Clerk) |
| `CLERK_SECRET_KEY` | `sk_test_...` (from Clerk) |
| `AUTH_ENABLED` | `true` (Set to `false` to bypass for local dev) |
| `VITE_AUTH_ENABLED` | `true` (Must match `AUTH_ENABLED`) |

### 3. CI/CD Protection
A GitHub Action has been added to `.github/workflows/ci.yml`. It will automatically run:
- TypeScript Check (`tsc`)
- Linting
- Playwright E2E Tests

This prevents broken builds from reaching your production server.
