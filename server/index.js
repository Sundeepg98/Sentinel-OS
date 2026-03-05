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
const { validateBody, schemas } = require('./lib/validation');
const { 
  GEMINI_API_KEY, 
  DEFAULT_MODEL, 
  generateStructuredContent, 
  getEmbedding,
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
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

morgan.token('id', (req) => req.id);
app.use(morgan(':id :method :url :status :res[content-length] - :response-time ms'));

app.use(cors());
app.use(express.json());

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

app.get('/health', (req, res) => {
  res.success({ status: 'healthy', db: isPostgres ? 'cloud' : 'local' });
});

const globalState = {
  knowledgeGraph: { concepts: {}, files: {} },
  searchIndex: new Index({ preset: 'score', tokenize: 'forward' }),
  clients: [] 
};

let isSyncing = false;
function spawnRAGWorker() {
  if (isSyncing) return;
  isSyncing = true;
  
  const worker = new Worker(path.join(__dirname, 'lib', 'rag-worker.js'));
  
  worker.on('message', (msg) => {
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

  worker.on('error', (err) => {
    logger.error('🧵 Worker Error:', err);
    isSyncing = false;
  });

  worker.on('exit', () => { isSyncing = false; });
}

const v1Router = express.Router();
v1Router.use(authGuard);

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 15, 
  message: { error: "AI Intelligence Engine is cooling down. Please wait 60 seconds." },
  standardHeaders: true,
  legacyHeaders: false,
});

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

v1Router.post('/admin/upload/:companyId', upload.single('file'), (req, res) => {
  if (!req.file) return res.error("No file uploaded", 400);
  logger.info(`📁 [Admin] File uploaded: ${req.file.filename} to ${req.params.companyId}`);
  res.success({ success: true, filename: req.file.filename });
});

v1Router.get('/admin/ai-logs', async (req, res) => {
  const logPath = path.join(__dirname, 'logs', 'ai-failures.json');
  try {
    const data = await fs.readFile(logPath, 'utf-8');
    res.success(JSON.parse(data));
  } catch (e) {
    res.success([]); 
  }
});

v1Router.post('/admin/error-logs', async (req, res) => {
  const errorData = req.body;
  const logPath = path.join(__dirname, 'logs', 'ui-errors.json');
  try {
    let logs = [];
    try {
      const existing = await fs.readFile(logPath, 'utf-8');
      logs = JSON.parse(existing);
    } catch (e) {}
    logs.push(errorData);
    await fs.writeFile(logPath, JSON.stringify(logs.slice(-100), null, 2));
    res.success({ logged: true });
  } catch (e) {
    res.error("Failed to log error", 500, e.message);
  }
});

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
    isSyncing
  });
});

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

v1Router.get('/dossier/:companyId', async (req, res) => {
  const companyDir = path.join(INTELLIGENCE_DIR, req.params.companyId);
  try {
    // If Postgres, we could check DB first, but for now we trust the synchronized graph
    const companyModules = Object.values(globalState.knowledgeGraph.files)
      .filter(f => f.company === req.params.companyId)
      .map(f => ({
        id: f.label.replace(/\s+/g, '-').toLowerCase(),
        fullId: `${req.params.companyId}/${f.label}.md`, // Mapping back
        label: f.label,
        type: 'markdown', // Simple mapping
        data: f.content
      }));
    res.success({ id: req.params.companyId, name: req.params.companyId.toUpperCase(), modules: companyModules });
  } catch (e) {
    res.error("Company dossier not found", 404);
  }
});

v1Router.get('/companies', async (req, res) => {
  const entries = await fs.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
  res.success(entries.filter(d => d.isDirectory()).map(d => ({ id: d.name, name: d.name.toUpperCase() })));
});

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
  server.close(() => { 
    logger.info("📡 Express server closed."); 
    if (!isPostgres) db.close(); 
    logger.info("🗄️ Database connection closed."); 
    process.exit(0); 
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
