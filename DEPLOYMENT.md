# Sentinel-OS Deployment Protocol 🚀

Use this guide to deploy the stable version of your Engineering Dossier to the cloud.

## 📡 One-Click Deployment (Recommended: Render.com)

Render is the most reliable free tier for full-stack Node.js applications that require file-system access (like our `/intelligence` folder).

1.  **Sign up/Login** at [Render.com](https://render.com) using your GitHub account.
2.  Click **"New +"** and select **"Web Service"**.
3.  Connect your repository: `Sundeepg98/Sentinel-OS`.
4.  **Important Settings:**
    *   **Environment**: `Node`
    *   **Region**: `Oregon (US West)` or closest to you.
    *   **Branch**: `main` (This ensures you only study the stable version).
    *   **Build Command**: `npm install && npm run build && cd server && npm install`
    *   **Start Command**: `node server/index.js`
    *   **Instance Type**: `Free`

5.  **Environment Variables:**
    *   Click the **"Advanced"** tab.
    *   Add `GEMINI_API_KEY`: `AIzaSyD-RPb_Ym57U_tQpO1GkEMpm1QACOrI_4s`
    *   Add `PORT`: `10000` (Render's default).

6.  Click **"Create Web Service"**.

---

## 🛠️ Verification Checklist
Once the build finishes (approx. 2-3 minutes), Render will provide a URL like `https://sentinel-os.onrender.com`.

- [ ] Open the URL on your phone or another browser.
- [ ] Verify the **Mailin** and **Turing** profiles load correctly.
- [ ] Test the **Active Recall** toggle.
- [ ] Verify the **AI Deep Drill** generates a question.

---

## 🚦 Future Updates
Because we connected the `main` branch:
- To update your notes: Edit the markdown files in `/intelligence` on your local `main` branch and `git push`.
- To keep developing features: Switch to the `v2-development` branch. The live site will **not** change until we explicitly merge `v2` into `main`.
