# Sentinel-OS Foundational Mandates 🛡️

This file contains critical engineering standards and "memories" discovered during development to prevent regression and runtime failures.

## 🚦 System Integrity
- **Surgical Process Management:** Never use `taskkill /F /IM node.exe`. It terminates the active Gemini CLI session. Always use port-specific termination:
  `Get-NetTCPConnection -LocalPort [PORT] | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`

## 🧠 Intelligence Engine (Gemini API)
- **Model Naming:** The `GoogleGenerativeAI` SDK (v1beta) requires **fully qualified** model strings. Use `models/gemini-1.5-flash` or `models/gemini-pro`.
- **Lazy Initialization:** Initialize the GenerativeAI instance *inside* the request handler or via a getter function to ensure environment variables (via `dotenv`) are fully loaded before use.

## 🌐 Networking & Routing
- **Express 5+ Wildcards:** Standard `*` wildcards in Express routes are deprecated/restricted. Use a regex object `/(.*)/` or named parameters `/:path*` for SPA catch-all routes.
- **Proxy Reliability:** Vite proxies to `/api` require the backend to be listening on the exact configured port (default `3001`).

## 📁 Intelligence Harvester
- **Directory Resolution:** Always use `path.join(__dirname, ...)` for file system operations in the backend to ensure portability across different startup contexts (local shell vs. background jobs).
- **Graceful Failure:** The harvester must skip malformed markdown files instead of crashing the process.
