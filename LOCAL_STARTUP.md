# 🛠️ Sentinel-OS | Local Development Guide

This guide details how to spin up the industrial-grade Sentinel-OS stack on your local machine.

## 🚀 Quick Start (3 Steps)

### 1. Clone & Install
```bash
git clone https://github.com/Sundeepg98/Sentinel-OS.git
cd Sentinel-OS
npm install
```

### 2. Environment Configuration
Create a file named `.env.local` in the **root directory** and add the following:

```env
GEMINI_API_KEY='YOUR_KEY_HERE'
VITE_CLERK_PUBLISHABLE_KEY='pk_test_...'
CLERK_SECRET_KEY='sk_test_...'
VITE_AUTH_ENABLED='false'
AUTH_ENABLED='false'
```

### 3. Launch the Stack
Sentinel-OS includes an automated startup script for Windows that clears orphaned processes.

```bash
# Best for Windows (Clears ports 5173/3002 automatically)
npm run dev:windows

# Standard (cross-platform)
npm run dev
```

---

## 🛰️ Troubleshooting: The "Polluted Session" Error
If you see **"Invalid Publishable Key"** in your browser console even after setting the correct key in `.env.local`, your terminal memory may be "poisoned."

**The Fix**: Run this command in PowerShell to clear the polluted variables:
```powershell
Remove-Item Env:\VITE_CLERK_PUBLISHABLE_KEY -ErrorAction SilentlyContinue
Remove-Item Env:\VITE_AUTH_ENABLED -ErrorAction SilentlyContinue
```
Then, restart the stack with `npm run dev:windows`.

---

## 🧪 Quality Gates
```bash
npm test   # Runs Full Suite
npm lint   # Validates Code Style
```

---
*Built for Architects by Sentinel | Optimized for L6+ Infrastructure & Systems Engineering Preps.*
