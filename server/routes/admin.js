const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { db, isPostgres } = require('../lib/db');
const { INTELLIGENCE_DIR } = require('../lib/harvester');
const { globalState } = require('../lib/state');

const router = express.Router();

// --- 🛠️ FILE UPLOAD CONFIGURATION ---
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const companyId = req.params.companyId || 'mailin';
    const uploadPath = path.join(INTELLIGENCE_DIR, companyId);
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (e) {
      cb(e, null);
    }
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, cleanName.endsWith('.md') ? cleanName : `${cleanName}.md`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.md') {
      cb(null, true);
    } else {
      cb(new Error('Only Markdown (.md) files are allowed'));
    }
  }
});

/**
 * @openapi
 * /admin/upload/{companyId}:
 *   post:
 *     summary: Upload a new technical dossier (Markdown)
 */
router.post('/upload/:companyId', upload.single('file'), (req, res) => {
  if (!req.file) return res.error("No file uploaded", 400);
  res.success({ success: true, filename: req.file.filename });
});

/**
 * @openapi
 * /admin/companies/{companyId}:
 *   post:
 *     summary: Create a new company intelligence context
 */
router.post('/companies/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const companyPath = path.join(INTELLIGENCE_DIR, companyId.toLowerCase());
  try {
    await fs.mkdir(companyPath, { recursive: true });
    res.success({ success: true });
  } catch (e) {
    res.error("Failed to create company context", 500, e.message);
  }
});

/**
 * @openapi
 * /admin/files/{companyId}/{filename}:
 *   delete:
 *     summary: Physically delete a dossier and purge its neural vectors
 */
router.delete('/files/:companyId/:filename', async (req, res) => {
  const { companyId, filename } = req.params;
  const filePath = path.join(INTELLIGENCE_DIR, companyId, filename);
  try {
    await fs.unlink(filePath);
    res.success({ success: true });
  } catch (e) {
    res.error("Failed to delete technical dossier", 500, e.message);
  }
});

/**
 * @openapi
 * /admin/ai-logs:
 *   get:
 *     summary: Retrieve AI generation failure logs from the database
 */
router.get('/ai-logs', async (req, res) => {
  try {
    let rows;
    if (isPostgres) {
      const dbRes = await db.query("SELECT * FROM system_logs WHERE type = 'AI' ORDER BY timestamp DESC LIMIT 100");
      rows = dbRes.rows;
    } else {
      rows = db.prepare("SELECT * FROM system_logs WHERE type = 'AI' ORDER BY timestamp DESC LIMIT 100").all();
    }
    res.success(rows);
  } catch (e) {
    res.success([]); 
  }
});

/**
 * @openapi
 * /admin/error-logs:
 *   post:
 *     summary: Log frontend application crashes to the persistent database
 */
router.post('/error-logs', async (req, res) => {
  const { message, stack, componentStack, url } = req.body;
  try {
    const payload = componentStack ? `Component: ${componentStack}` : null;
    if (isPostgres) {
      await db.query(
        "INSERT INTO system_logs (type, category, message, payload, stack, url) VALUES ($1, $2, $3, $4, $5, $6)",
        ['UI', 'CRASH', message, payload, stack, url]
      );
    } else {
      db.prepare(
        "INSERT INTO system_logs (type, category, message, payload, stack, url) VALUES (?, ?, ?, ?, ?, ?)"
      ).run('UI', 'CRASH', message, payload, stack, url);
    }
    res.success({ logged: true });
  } catch (e) {
    res.error("Failed to persist UI error log", 500, e.message);
  }
});

/**
 * @openapi
 * /admin/ui-logs:
 *   get:
 *     summary: Retrieve recorded frontend crashes from the database
 */
router.get('/ui-logs', async (req, res) => {
  try {
    let rows;
    if (isPostgres) {
      const dbRes = await db.query("SELECT * FROM system_logs WHERE type = 'UI' ORDER BY timestamp DESC LIMIT 100");
      rows = dbRes.rows;
    } else {
      rows = db.prepare("SELECT * FROM system_logs WHERE type = 'UI' ORDER BY timestamp DESC LIMIT 100").all();
    }
    res.success(rows);
  } catch (e) {
    res.success([]); 
  }
});

/**
 * @openapi
 * /admin/export-db:
 *   get:
 *     summary: Export the physical SQLite database (Local only)
 */
router.get('/export-db', (req, res) => {
  const dbPath = path.join(__dirname, '..', 'sentinel.db');
  res.download(dbPath, `sentinel-backup-${new Date().toISOString().split('T')[0]}.db`);
});

module.exports = router;
