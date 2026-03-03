# Sentinel-OS 🛡️

Sentinel-OS is a high-density, command-center style dashboard designed for **Technical Interview Intelligence**. It turns your raw technical notes into a premium, interactive "Operating System" for career preparation.

![Project Preview](.playwright-mcp/page-2026-03-03T07-38-40-906Z.png)

## 🚀 The Staff Engineer Workflow
Sentinel-OS is built on a "Pluggable Intelligence" architecture. You don't edit UI code to add technical prep; you manage it via the file system.

1. **Drop a Markdown file** into `/intelligence/[company-name]/`.
2. **Tag it** with a module type (`playbook`, `map`, `list`, `markdown`) in the YAML frontmatter.
3. **The Harvester** (Node.js backend) automatically discovers, parses, and renders it in the UI.

## 🛠️ Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS v4 (Modern native CSS config).
- **Backend**: Node.js Harvester with `gray-matter` for technical metadata extraction.
- **Visuals**: Framer Motion for glassmorphic transitions and Lucide for iconography.
- **Automation**: Playwright MCP for integrated E2E testing and visual verification.

## 📁 Repository Structure
- `/src`: The glassmorphic technical shell (React).
- `/server`: The Sentinel Harvester (Node.js API).
- `/intelligence`: Your technical database (Plain Markdown).
  - `/mailin`: Deliverability, Networking, and low-level Node.js internals.
  - `/turing`: Cloud Infrastructure, Pulumi patterns, and System Design.

## 🚦 Getting Started
1. Install dependencies:
   ```bash
   npm install && cd server && npm install
   ```
2. Start the Full-Stack Environment:
   ```bash
   npm run dev
   ```
   *Starts both Vite (5173) and the Harvester (3001) concurrently.*

## 🧩 Module Types
- `markdown`: Standard documentation with premium typography.
- `map`: Visual interactive cards for system design and infra patterns.
- `playbook`: High-density "Trap vs. Optimal" diagnostic drills.
- `checklist`: Company-scoped readiness trackers with persistent state.

---
*Maintained by Sundeep | Optimized for L6+ Infrastructure & Systems Engineering Preps.*
