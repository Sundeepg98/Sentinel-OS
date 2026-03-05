# Security Policy 🛡️

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.5.x   | :white_check_mark: |
| < 2.0.0 | :x:                |

## Reporting a Vulnerability

We take the security of Sentinel-OS seriously. If you find a technical vulnerability, please do not open a public issue. Instead, email the maintainer directly.

### Our Process:
1. **Response**: We will respond within 24 hours.
2. **Analysis**: We will confirm the vulnerability and determine the blast radius.
3. **Fix**: A patch will be deployed to Render within 48 hours.
4. **Disclosure**: A public security advisory will be issued after the fix is verified.

### Protected Areas:
- **Clerk Integration**: JWT verification and session handling.
- **RAG Engine**: Prompt injection prevention.
- **Database**: SQL injection protection via parameterized queries.

---
*Stay Rugged.*
