const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { db, isPostgres } = require('../lib/db');
const { INTELLIGENCE_DIR } = require('../lib/harvester');
const { validateParams, validateQuery, schemas } = require('../lib/validation');
const { AppError, asyncHandler } = require('../lib/errors');

const router = express.Router();

const rateLimit = require('express-rate-limit');
const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 actions per 15 minutes
  keyGenerator: (req) => req.userId || req.ip,
  message: { error: "Administrative actions are rate-limited. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

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
 *     tags: [Admin Management]
 *     summary: Upload a new technical dossier (Markdown)
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/upload/:companyId', adminRateLimiter, validateParams(schemas.pathParamsSchema), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.error("No file uploaded", 400);
  res.success({ success: true, filename: req.file.filename });
}));

/**
 * @openapi
 * /admin/companies/{companyId}:
 *   post:
 *     tags: [Admin Management]
 *     summary: Create a new company intelligence context
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/companies/:companyId', adminRateLimiter, validateParams(schemas.pathParamsSchema), asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const companyPath = path.join(INTELLIGENCE_DIR, companyId.toLowerCase());
  try {
    await fs.mkdir(companyPath, { recursive: true });
    req.log.info({ companyId }, "🏢 [Admin] Company context created");
    res.success({ success: true });
  } catch (e) {
    throw new AppError("Failed to create company context", 500, e.message);
  }
}));

/**
 * @openapi
 * /admin/files/{companyId}/{filename}:
 *   delete:
 *     tags: [Admin Management]
 *     summary: Physically delete a dossier and purge its neural vectors
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 */
router.delete('/files/:companyId/:filename', adminRateLimiter, validateParams(schemas.pathParamsSchema), asyncHandler(async (req, res) => {
  const { companyId, filename } = req.params;
  const filePath = path.join(INTELLIGENCE_DIR, companyId, filename);
  try {
    await fs.unlink(filePath);
    req.log.info({ companyId, filename }, "🗑️ [Admin] File deleted");
    res.success({ success: true });
  } catch (e) {
    throw new AppError("Failed to delete technical dossier", 500, e.message);
  }
}));

/**
 * @openapi
 * /admin/ai-logs:
 *   get:
 *     tags: [Audit & Telemetry]
 *     summary: Retrieve AI generation failure logs from the database with pagination
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 */
router.get('/ai-logs', validateQuery(schemas.paginationSchema), asyncHandler(async (req, res) => {
  const limit = Math.min(req.query.limit || 100, 200);
  const offset = Math.max(req.query.offset || 0, 0);

  try {
    let rows;
    if (isPostgres) {
      const dbRes = await db.query(
        "SELECT * FROM system_logs WHERE type = 'AI' ORDER BY timestamp DESC LIMIT $1 OFFSET $2",
        [limit, offset]
      );
      rows = dbRes.rows;
    } else {
      rows = db.prepare("SELECT * FROM system_logs WHERE type = 'AI' ORDER BY timestamp DESC LIMIT ? OFFSET ?").all(limit, offset);
    }
    res.success(rows);
  } catch {
    res.success([]); 
  }
}));

/**
 * @openapi
 * /admin/ui-logs:
 *   get:
 *     tags: [Audit & Telemetry]
 *     summary: Retrieve recorded frontend crashes from the database with pagination
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 */
router.get('/ui-logs', validateQuery(schemas.paginationSchema), asyncHandler(async (req, res) => {
  const limit = Math.min(req.query.limit || 100, 200);
  const offset = Math.max(req.query.offset || 0, 0);

  try {
    let rows;
    if (isPostgres) {
      const dbRes = await db.query(
        "SELECT * FROM system_logs WHERE type = 'UI' ORDER BY timestamp DESC LIMIT $1 OFFSET $2",
        [limit, offset]
      );
      rows = dbRes.rows;
    } else {
      rows = db.prepare("SELECT * FROM system_logs WHERE type = 'UI' ORDER BY timestamp DESC LIMIT ? OFFSET ?").all(limit, offset);
    }
    res.success(rows);
  } catch {
    res.success([]); 
  }
}));

/**
 * @openapi
 * /admin/export-db:
 *   get:
 *     tags: [Admin Management]
 *     summary: Export the physical SQLite database (Local only)
 */
router.get('/export-db', adminRateLimiter, asyncHandler(async (req, res) => {
  if (isPostgres) {
    throw new AppError("Database export is only available for local SQLite instances. Please use cloud-native backup tools for Managed Postgres.", 400);
  }
  const dbPath = path.join(__dirname, '..', 'sentinel.db');
  res.download(dbPath, `sentinel-backup-${new Date().toISOString().split('T')[0]}.db`);
}));

module.exports = router;
