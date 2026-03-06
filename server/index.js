const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { Worker } = require('worker_threads');
const { Index } = require('flexsearch');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');
const hpp = require('hpp');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const morgan = require('morgan');
const pino = require('pino');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { db, initDB, isPostgres } = require('./lib/db');

// --- 🛠️ ENGINEERING BASIC: API DOCUMENTATION ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sentinel-OS API',
      version: '1.0.0',
      description: 'Technical Intelligence & RAG Engine API',
    },
    servers: [{ url: '/api/v1' }],
  },
  apis: ['./server/index.js'], // Document endpoints in this file
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);

const { authGuard } = require('./lib/auth');
const { validateBody, validateQuery, schemas } = require('./lib/validation');
const { 
  GEMINI_API_KEY, 
  DEFAULT_MODEL, 
  generateStructuredContent, 
  getEmbedding,
  getCircuitState,
  DRILL_SCHEMA,
  INCIDENT_SCHEMA,
  EVAL_SCHEMA,
  POST_MORTEM_SCHEMA
} = require('./lib/intelligence');
const { 
  getKnowledgeGraph, 
  getSearchIndex, 
  INTELLIGENCE_DIR 
} = require('./lib/harvester');

// --- 🛠️ ENGINEERING BASIC: STRUCTURED LOGGING ---
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
});

// --- 🛠️ ENGINEERING BASIC: ENV VALIDATION ---
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  PORT: z.string().default("3002"),
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  AUTH_ENABLED: z.string().optional().transform(v => v === 'true'),
  DATABASE_URL: z.string().optional()
});

const env = envSchema.parse(process.env);

const app = express();
const PORT = env.PORT;
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');

// Initialize Core Systems
initDB();

// Ensure Logs Directory Exists
const ensureLogsDir = async () => {
  const logDir = path.join(__dirname, 'logs');
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (err) {
    logger.error('Failed to create logs directory:', err);
  }
};
ensureLogsDir();

// --- 🛡️ ENGINEERING BASIC: GLOBAL SECURITY & RATE LIMITING ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://clerk.accounts.dev", "https://*.clerk.accounts.dev"],
      connectSrc: ["'self'", "https://clerk.accounts.dev", "https://*.clerk.accounts.dev", "https://api.clerk.dev"],
      imgSrc: ["'self'", "data:", "https://*.clerk.com", "https://images.clerk.dev"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'self'", "https://*.clerk.accounts.dev"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// --- 🛡️ SECURITY BASIC: Prevent HTTP Parameter Pollution ---
app.use(hpp());

const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 100 requests per minute average
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalRateLimiter);

// Compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers.accept === 'text/event-stream') return false;
    return compression.filter(req, res);
  }
}));

app.use((req, res, next) => {
  req.id = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.id);
  next();
});

morgan.token('id', (req) => req.id);
app.use(morgan(':id :method :url :status :res[content-length] - :response-time ms'));

// --- 🛡️ ENGINEERING BASIC: STRICT CORS POLICY ---
const allowedOrigins = [
  'http://localhost:5173',
  'https://sentinel-os-staging.onrender.com',
  'https://sentinel-os-bcsv.onrender.com'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Strict CORS Policy: Origin not allowed'));
    }
  },
  credentials: true
}));

// 🛡️ SECURITY BASIC: Prevent Large Payload DoS Attacks
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Inject API Standard Envelope
const { responseEnvelope } = require('./lib/response');
app.use(responseEnvelope);

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

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- 🏥 HEALTH CHECK ---
app.get('/health', async (req, res) => {
  try {
    const dbStatus = isPostgres ? 'cloud' : 'local';
    if (isPostgres) {
      await db.query('SELECT 1');
    } else {
      db.prepare('SELECT 1').get();
    }

    res.success({ 
      status: 'healthy', 
      db: dbStatus,
      worker: {
        active: !!activeWorker,
        syncing: isSyncing
      },
      aiEngine: {
        circuitState: getCircuitState()
      },
      version: '2.6.0'
    });
  } catch (err) {
    res.error("System Unstable", 500, {
      db: "DOWN",
      message: err.message
    });
  }
});

// --- SYNCED STATE ---
const globalState = {
  knowledgeGraph: { concepts: {}, files: {} },
  searchIndex: new Index({ preset: 'score', tokenize: 'forward' }),
  clients: [] 
};

// --- RAG WORKER ISOLATION ---
let isSyncing = false;
let activeWorker = null;

function spawnRAGWorker() {
  if (isSyncing) return;
  isSyncing = true;
  
  activeWorker = new Worker(path.join(__dirname, 'lib', 'rag-worker.js'));
  
  activeWorker.on('message', (msg) => {
    if (msg.status === 'complete') {
      logger.info(`📡 Intelligence Hydrated from Worker (${msg.duration}s)`);
      globalState.knowledgeGraph = msg.knowledgeGraph;
      
      const newIndex = new Index({ preset: 'score', tokenize: 'forward' });
      Object.entries(globalState.knowledgeGraph.files).forEach(([id, file]) => {
        newIndex.add(id, file.content);
      });
      globalState.searchIndex = newIndex;
      
      const payload = JSON.stringify({ type: 'SYNC_COMPLETE', hotReload: !!msg.isHotReload });
      globalState.clients.forEach(c => {
        try { c.res.write(`data: ${payload}\n\n`); } catch (e) {}
      });

      logger.info(`🔍 Search Index Synchronized. Notified ${globalState.clients.length} clients.`);
      isSyncing = false;
    }
  });

  activeWorker.on('error', (err) => {
    logger.error('🧵 Worker Error:', err);
    isSyncing = false;
  });

  activeWorker.on('exit', () => { 
    isSyncing = false; 
    activeWorker = null;
  });
}

// --- API V1 ROUTER ---
const v1Router = express.Router();
v1Router.use(authGuard);

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 15, 
  message: { error: "AI Intelligence Engine is cooling down. Please wait 60 seconds." },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 actions per 15 minutes
  message: { error: "Administrative actions are rate-limited. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- REAL-TIME STREAM ---
v1Router.get('/intelligence/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const clientId = Date.now();
  globalState.clients.push({ id: clientId, res });
  res.write(':ok\n\n');
  req.on('close', () => {
    globalState.clients = globalState.clients.filter(c => c.id !== clientId);
  });
});

// --- ADMIN & MANAGEMENT ENDPOINTS ---

/**
 * @openapi
 * /admin/upload/{companyId}:
 *   post:
 *     summary: Upload a new technical dossier (Markdown)
 */
v1Router.post('/admin/upload/:companyId', adminRateLimiter, upload.single('file'), (req, res) => {
  if (!req.file) return res.error("No file uploaded", 400);
  logger.info(`📁 [Admin] File uploaded: ${req.file.filename} to ${req.params.companyId}`);
  res.success({ success: true, filename: req.file.filename });
});

/**
 * @openapi
 * /admin/companies/{companyId}:
 *   post:
 *     summary: Create a new company intelligence context
 */
v1Router.post('/admin/companies/:companyId', adminRateLimiter, async (req, res) => {
  const { companyId } = req.params;
  const companyPath = path.join(INTELLIGENCE_DIR, companyId.toLowerCase());
  try {
    await fs.mkdir(companyPath, { recursive: true });
    logger.info(`🏢 [Admin] Company context created: ${companyId}`);
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
v1Router.delete('/admin/files/:companyId/:filename', adminRateLimiter, async (req, res) => {
  const { companyId, filename } = req.params;
  const filePath = path.join(INTELLIGENCE_DIR, companyId, filename);
  try {
    await fs.unlink(filePath);
    logger.info(`🗑️ [Admin] File deleted: ${filename} from ${companyId}`);
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
v1Router.get('/admin/ai-logs', async (req, res) => {
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
v1Router.post('/admin/error-logs', async (req, res) => {
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
v1Router.get('/admin/ui-logs', async (req, res) => {
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
v1Router.get('/admin/export-db', (req, res) => {
  const dbPath = path.join(__dirname, 'sentinel.db');
  res.download(dbPath, `sentinel-backup-${new Date().toISOString().split('T')[0]}.db`);
});

// --- STANDARD AI ENDPOINTS (v1) ---

/**
 * @openapi
 * /intelligence/stats:
 *   get:
 *     summary: Retrieve system-wide intelligence telemetry
 */
v1Router.get('/intelligence/stats', async (req, res) => {
  let chunksCount, historyCount, learnedCount;
  
  if (isPostgres) {
    const chunksRes = await db.query("SELECT count(*) as count FROM chunks_metadata");
    const historyRes = await db.query("SELECT count(*) as count FROM interaction_history");
    const learnedRes = await db.query("SELECT count(*) as count FROM dossiers WHERE company = 'user'");
    chunksCount = parseInt(chunksRes.rows[0].count);
    historyCount = parseInt(historyRes.rows[0].count);
    learnedCount = parseInt(learnedRes.rows[0].count);
  } else {
    chunksCount = db.prepare("SELECT count(*) as count FROM chunks_metadata").get().count;
    historyCount = db.prepare("SELECT count(*) as count FROM interaction_history").get().count;
    learnedCount = db.prepare("SELECT count(*) as count FROM chunks_metadata WHERE file_id LIKE 'learned/%'").get().count;
  }

  res.success({
    totalChunks: chunksCount,
    interactions: historyCount,
    learnedAssets: learnedCount,
    model: DEFAULT_MODEL,
    uptime: process.uptime(),
    env: env.NODE_ENV,
    auth: env.AUTH_ENABLED ? 'enabled' : 'disabled',
    aiEngine: {
      circuitState: getCircuitState()
    },
    isSyncing
  });
});

/**
 * @openapi
 * /intelligence/graph:
 *   get:
 *     summary: Generate the 3D Architectural Nervous System data
 */
v1Router.get('/intelligence/graph', async (req, res) => {
  const nodes = []; const links = [];
  let userRows;
  
  if (isPostgres) {
    const res = await db.query("SELECT key, value FROM user_state WHERE user_id = $1 AND (key LIKE 'tracker-%' OR key LIKE 'score-%')", [req.userId]);
    userRows = res.rows;
  } else {
    userRows = db.prepare("SELECT key, value FROM user_state WHERE user_id = ? AND (key LIKE 'tracker-%' OR key LIKE 'score-%')").all(req.userId);
  }

  const trackers = {}; const scores = {};
  userRows.forEach(row => {
    const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    if (row.key.startsWith('tracker-')) trackers[row.key] = val;
    if (row.key.startsWith('score-')) scores[row.key.replace('score-', '')] = val;
  });

  Object.entries(globalState.knowledgeGraph.files).forEach(([id, data]) => {
    const trackerKey = `tracker-${data.company}-${id.split('/').pop().replace('.md', '').toLowerCase()}`;
    const moduleTasks = trackers[trackerKey] || [];
    const trackerReadiness = moduleTasks.length > 0 ? (moduleTasks.filter(t => t.done).length / moduleTasks.length) * 0.5 : 0;
    const moduleScore = scores[id]?.lastScore || 0;
    const readiness = trackerReadiness + ((moduleScore / 10) * 0.5);
    nodes.push({ id, label: data.label, group: 'module', company: data.company, val: 15, readiness, blastRadius: data.keywords.length });
  });

  Object.entries(globalState.knowledgeGraph.concepts).forEach(([concept, files]) => {
    if (files.length > 1) {
      nodes.push({ id: `concept:${concept}`, label: concept, group: 'concept', company: 'global', val: 8 });
      files.forEach(f => links.push({ source: f.fileId, target: `concept:${concept}`, keyword: concept }));
    }
  });
  res.success({ nodes, links });
});

/**
 * @openapi
 * /intelligence/insights:
 *   get:
 *     summary: Retrieve contextual keywords and related semantic links for a specific dossier
 */
v1Router.get('/intelligence/insights', validateQuery(schemas.insightsQuerySchema), async (req, res) => {
  const { fileId: rawFileId } = req.query;
  if (!rawFileId) return res.error('Missing fileId', 400);
  
  const fileId = String(rawFileId).toLowerCase(); // 🚀 STRICT NORMALIZATION
  const graph = globalState.knowledgeGraph;
  const file = graph.files[fileId];
  if (!file) return res.success({ keywords: [], related: [] });
  
  try {
    const vector = await getEmbedding(file.content.slice(0, 1000));
    let related;
    if (isPostgres) {
      const dbRes = await db.query(
        "SELECT m.file_id, m.chunk_text, (m.embedding <=> $1) as distance FROM chunks_metadata m WHERE m.file_id != $2 ORDER BY distance LIMIT 5",
        [JSON.stringify(vector), fileId]
      );
      related = dbRes.rows.map(m => ({ fileId: m.file_id, company: m.file_id.split('/')[0], sharedKeyword: 'semantic similarity' }));
    } else {
      const semanticMatches = db.prepare(`SELECT m.file_id, m.chunk_text, v.distance FROM vec_chunks v JOIN chunks_metadata m ON v.id = m.id WHERE v.vector MATCH ? AND k = 5 AND m.file_id != ? ORDER BY distance`).all(new Float32Array(vector), fileId);
      related = semanticMatches.map(m => ({ fileId: m.file_id, company: m.file_id.split('/')[0], sharedKeyword: 'semantic similarity' }));
    }
    res.success({ keywords: file.keywords, related });
  } catch (e) { 
    res.success({ keywords: file.keywords, related: [] }); 
  }
});

/**
 * @openapi
 * /intelligence/search:
 *   get:
 *     summary: Perform a high-speed keyword search across the technical index
 */
v1Router.get('/intelligence/search', validateQuery(schemas.searchQuerySchema), (req, res) => {
  const { q } = req.query;
  if (!q) return res.success([]);
  const results = globalState.searchIndex.search(q, { limit: 10 });
  res.success(results.map(id => ({ id, ...globalState.knowledgeGraph.files[id] })));
});

/**
 * @openapi
 * /intelligence/semantic-search:
 *   post:
 *     summary: Deep vector search for conceptually related architectural modules
 */
v1Router.post('/intelligence/semantic-search', validateBody(schemas.semanticSearchSchema), async (req, res) => {
  const { q, limit } = req.body;
  try {
    const vector = await getEmbedding(q);
    let results;
    if (isPostgres) {
      const dbRes = await db.query(
        "SELECT m.file_id, m.chunk_text, (m.embedding <=> $1) as distance FROM chunks_metadata m ORDER BY distance LIMIT $2",
        [JSON.stringify(vector), limit]
      );
      results = dbRes.rows;
    } else {
      results = db.prepare(`SELECT m.file_id, m.chunk_text, v.distance FROM vec_chunks v JOIN chunks_metadata m ON v.id = m.id WHERE v.vector MATCH ? AND k = ? ORDER BY distance`).all(new Float32Array(vector), limit);
    }
    res.success(results);
  } catch (e) { res.error(e.message, 500); }
});

/**
 * @openapi
 * /intelligence/drill:
 *   post:
 *     summary: Generate a high-stakes technical drill based on dossier context
 */
v1Router.post('/intelligence/drill', aiRateLimiter, validateBody(schemas.drillRequestSchema), async (req, res) => {
  const { fileId, extraContext = "" } = req.body;
  if (!GEMINI_API_KEY) return res.error("AI Intelligence Engine Offline (API Key Missing)", 503);
  
  try {
    const context = extraContext || globalState.knowledgeGraph.files[fileId.toLowerCase()]?.content.slice(0, 3000) || "General System Architecture";
    const prompt = `You are a Staff Engineer interviewer. Generate ONE high-stakes technical drill.\nContext: ${context}`;
    const text = await generateStructuredContent(prompt, DRILL_SCHEMA);
    res.success(JSON.parse(text));
  } catch (error) { 
    res.error(error.message, 500); 
  }
});

/**
 * @openapi
 * /intelligence/incident:
 *   post:
 *     summary: Simulate a critical production incident based on architecture context
 */
v1Router.post('/intelligence/incident', aiRateLimiter, validateBody(schemas.incidentRequestSchema), async (req, res) => {
  const { moduleIds = [] } = req.body;
  if (!GEMINI_API_KEY) return res.error("AI Intelligence Engine Offline (API Key Missing)", 503);
  
  let context = moduleIds.map(id => globalState.knowledgeGraph.files[id.toLowerCase()]?.content.slice(0, 1000)).join('\n\n') || "General System Architecture";

  try {
    const prompt = `You are a Chaos Engineering simulator for a Staff Engineer. Context: ${context}. Generate a critical production incident (P0/P1) based on this architecture.`;
    const text = await generateStructuredContent(prompt, INCIDENT_SCHEMA);
    res.success(JSON.parse(text));
  } catch (error) { 
    res.error(error.message, 500); 
  }
});

/**
 * @openapi
 * /intelligence/incident/evaluate:
 *   post:
 *     summary: Evaluate an incident post-mortem response
 */
v1Router.post('/intelligence/incident/evaluate', aiRateLimiter, validateBody(schemas.incidentEvaluateSchema), async (req, res) => {
  const { userAnswer, incident } = req.body;
  if (!GEMINI_API_KEY) return res.error("AI Intelligence Engine Offline (API Key Missing)", 503);

  try {
    const prompt = `Staff Engineer Incident Post-Mortem.\nIncident: ${incident.title}\nActual Root Cause: ${incident.rootCause}\nIdeal Mitigation: ${incident.idealMitigation}\nCandidate's Response: "${userAnswer}"`;
    const text = await generateStructuredContent(prompt, POST_MORTEM_SCHEMA);
    const json = JSON.parse(text);

    if (json && json.score) {
      const numericScore = parseInt(json.score.split('/')[0]);
      if (isPostgres) {
        await db.query("INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) VALUES ($1, 'incident', $2, $3, $4, $5, $6)", [req.userId, incident.title, incident.title, userAnswer, text, isNaN(numericScore) ? 0 : numericScore]);
      } else {
        db.prepare(`INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) VALUES (?, 'incident', ?, ?, ?, ?, ?)`).run(req.userId, incident.title, incident.title, userAnswer, text, isNaN(numericScore) ? 0 : numericScore);
      }
    }
    res.success(json);
  } catch (error) { 
    res.error(error.message, 500); 
  }
});

/**
 * @openapi
 * /intelligence/evaluate:
 *   post:
 *     summary: Perform AI-driven evaluation of candidate responses
 */
v1Router.post('/intelligence/evaluate', aiRateLimiter, validateBody(schemas.evaluateRequestSchema), async (req, res) => {
  const { userAnswer, question, idealResponse, fileId } = req.body;
  try {
    const prompt = `Staff Interview Evaluation. Q: ${question}\nIdeal: ${idealResponse}\nCandidate: "${userAnswer}"`;
    const text = await generateStructuredContent(prompt, EVAL_SCHEMA);
    const json = JSON.parse(text);
    if (json && json.score && fileId) {
      const numericScore = parseInt(json.score.split('/')[0]);
      if (!isNaN(numericScore)) {
        if (isPostgres) {
          await db.query("INSERT INTO user_state (user_id, key, value) VALUES ($1, $2, $3) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP", [req.userId, `score-${fileId}`, JSON.stringify({ lastScore: numericScore })]);
          await db.query("INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) VALUES ($1, 'drill', $2, $3, $4, $5, $6)", [req.userId, fileId, question, userAnswer, text, numericScore]);
        } else {
          db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(req.userId, `score-${fileId}`, JSON.stringify({ lastScore: numericScore }));
          db.prepare(`INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) VALUES (?, 'drill', ?, ?, ?, ?, ?)`).run(req.userId, fileId, question, userAnswer, text, numericScore);
        }
      }
    }
    res.success(json);
  } catch (error) { res.error(error.message, 500); }
});

/**
 * @openapi
 * /dossier/{companyId}:
 *   get:
 *     summary: Retrieve the full technical context for a specific enterprise
 */
v1Router.get('/dossier/:companyId', async (req, res) => {
  try {
    const companyModules = Object.entries(globalState.knowledgeGraph.files)
      .filter(([id, f]) => f.company === req.params.companyId)
      .map(([id, f]) => ({
        id: id.split('/').pop().replace('.md', ''), 
        fullId: id, // Use the physically indexed normalized ID
        label: f.label,
        type: 'markdown', 
        data: f.content
      }));
    res.success({ id: req.params.companyId, name: req.params.companyId.toUpperCase(), modules: companyModules.sort((a, b) => a.id.localeCompare(b.id)) });
  } catch (e) {
    res.error("Company dossier not found", 404);
  }
});

/**
 * @openapi
 * /companies:
 *   get:
 *     summary: List all available technical context clusters
 */
v1Router.get('/companies', async (req, res) => {
  const entries = await fs.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
  res.success(entries.filter(d => d.isDirectory()).map(d => ({ id: d.name, name: d.name.toUpperCase() })));
});

/**
 * @openapi
 * /state/{key}:
 *   get:
 *     summary: Retrieve persistent user state
 *   post:
 *     summary: Persist user state
 */
v1Router.get('/state/:key', async (req, res) => {
  let row;
  if (isPostgres) {
    const dbRes = await db.query("SELECT value FROM user_state WHERE user_id = $1 AND key = $2", [req.userId, req.params.key]);
    row = dbRes.rows[0];
  } else {
    row = db.prepare("SELECT value FROM user_state WHERE user_id = ? AND key = ?").get(req.userId, req.params.key);
  }
  const val = row ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : null;
  res.success({ value: val });
});

v1Router.post('/state/:key', async (req, res) => {
  if (isPostgres) {
    await db.query("INSERT INTO user_state (user_id, key, value) VALUES ($1, $2, $3) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP", [req.userId, req.params.key, JSON.stringify(req.body.value)]);
  } else {
    db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(req.userId, req.params.key, JSON.stringify(req.body.value));
  }
  res.success({ success: true });
});

// 🛡️ ENGINEERING BASIC: Strict API 404 Fallback
v1Router.use((req, res) => {
  res.error("API Endpoint Not Found", 404);
});

app.use('/api/v1', v1Router);

app.use(express.static(FRONTEND_DIST, {
  maxAge: '1y',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.get(/(.*)/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));

app.use((err, req, res, next) => {
  logger.error({ id: req.id, path: req.path, message: err.message, stack: env.NODE_ENV !== 'production' ? err.stack : undefined }, '💥 Unhandled Server Error');
  res.status(err.status || 500).error(env.NODE_ENV !== 'production' ? err.message : "An unexpected error occurred.", err.status || 500);
});

const server = app.listen(PORT, () => {
  logger.info(`Intelligence Engine ACTIVE on ${PORT}`);
  spawnRAGWorker();
});

function gracefulShutdown() {
  logger.info("🛑 Signal received. Shutting down gracefully...");
  
  if (activeWorker) {
    logger.info("🧵 Terminating RAG Worker...");
    activeWorker.terminate();
  }

  server.close(async () => { 
    logger.info("📡 Express server closed."); 
    try {
      if (!isPostgres) {
        db.close(); 
      } else if (db.close) {
        await db.close();
      }
      logger.info("🗄️ Database connection closed."); 
    } catch (e) {
      logger.error("Failed to close database:", e);
    }
    process.exit(0); 
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, '💥 Unhandled Rejection at Promise');
});

process.on('uncaughtException', (err) => {
  logger.error(err, '💥 Uncaught Exception thrown');
  gracefulShutdown();
});
