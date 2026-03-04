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
const { db, initDB } = require('./lib/db');
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
  AUTH_ENABLED: z.string().optional().transform(v => v === 'true')
});

const env = envSchema.parse(process.env);

const app = express();
const PORT = env.PORT;
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');

// Initialize Core Systems
initDB();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

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
    // Sanitize and ensure .md extension
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, cleanName.endsWith('.md') ? cleanName : `${cleanName}.md`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.md') {
      cb(null, true);
    } else {
      cb(new Error('Only Markdown (.md) files are allowed'));
    }
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), requestId: req.id });
});

// --- SYNCED STATE ---
const globalState = {
  knowledgeGraph: { concepts: {}, files: {} },
  searchIndex: new Index({ preset: 'score', tokenize: 'forward' }),
  clients: [] 
};

// --- RAG WORKER ISOLATION ---
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

// Auth Middleware
const authGuard = (req, res, next) => {
  req.userId = 'local-admin'; 
  next();
};

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

v1Router.post('/admin/upload/:companyId', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  logger.info(`📁 [Admin] File uploaded: ${req.file.filename} to ${req.params.companyId}`);
  res.json({ success: true, filename: req.file.filename });
});

v1Router.post('/admin/companies/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const companyPath = path.join(INTELLIGENCE_DIR, companyId.toLowerCase());
  try {
    await fs.mkdir(companyPath, { recursive: true });
    logger.info(`🏢 [Admin] Company directory created: ${companyId}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to create company", details: e.message });
  }
});

v1Router.delete('/admin/files/:companyId/:filename', async (req, res) => {
  const { companyId, filename } = req.params;
  const filePath = path.join(INTELLIGENCE_DIR, companyId, filename);
  try {
    await fs.unlink(filePath);
    logger.info(`🗑️ [Admin] File deleted: ${filename} from ${companyId}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete file", details: e.message });
  }
});

v1Router.get('/admin/export-db', (req, res) => {
  const dbPath = path.join(__dirname, 'sentinel.db');
  res.download(dbPath, `sentinel-backup-${new Date().toISOString().split('T')[0]}.db`);
});

// --- STANDARD AI ENDPOINTS (v1) ---

v1Router.get('/intelligence/stats', (req, res) => {
  const chunks = db.prepare("SELECT count(*) as count FROM chunks_metadata").get();
  const history = db.prepare("SELECT count(*) as count FROM interaction_history").get();
  const learned = db.prepare("SELECT count(*) as count FROM chunks_metadata WHERE file_id LIKE 'learned/%'").get();
  res.json({
    totalChunks: chunks.count,
    interactions: history.count,
    learnedAssets: learned.count,
    model: DEFAULT_MODEL,
    uptime: process.uptime(),
    env: env.NODE_ENV,
    auth: env.AUTH_ENABLED ? 'enabled' : 'disabled',
    isSyncing
  });
});

v1Router.get('/intelligence/graph', (req, res) => {
  const nodes = []; const links = [];
  const rows = db.prepare("SELECT key, value FROM user_state WHERE user_id = ? AND (key LIKE 'tracker-%' OR key LIKE 'score-%')").all(req.userId);
  const trackers = {}; const scores = {};
  rows.forEach(row => {
    if (row.key.startsWith('tracker-')) trackers[row.key] = JSON.parse(row.value);
    if (row.key.startsWith('score-')) scores[row.key.replace('score-', '')] = JSON.parse(row.value);
  });
  const learnedModules = db.prepare("SELECT DISTINCT file_id, metadata FROM chunks_metadata WHERE file_id LIKE 'learned/%'").all();
  Object.entries(globalState.knowledgeGraph.files).forEach(([id, data]) => {
    const trackerKey = `tracker-${data.company}-${id.split('/').pop().replace('.md', '').toLowerCase()}`;
    const moduleTasks = trackers[trackerKey] || [];
    const trackerReadiness = moduleTasks.length > 0 ? (moduleTasks.filter(t => t.done).length / moduleTasks.length) * 0.5 : 0;
    const moduleScore = scores[id]?.lastScore || 0;
    const readiness = trackerReadiness + ((moduleScore / 10) * 0.5);
    nodes.push({ id, label: data.label, group: 'module', company: data.company, val: 15, readiness, blastRadius: data.keywords.length });
  });
  learnedModules.forEach(lm => {
    const meta = JSON.parse(lm.metadata);
    nodes.push({ id: lm.file_id, label: `💡 Learned: ${lm.file_id.split('/').pop()}`, group: 'learned', company: 'user', val: 10, readiness: 1, learned: true, originalModule: meta.originalModule });
    if (meta.originalModule) links.push({ source: meta.originalModule, target: lm.file_id, type: 'learned-from' });
  });
  Object.entries(globalState.knowledgeGraph.concepts).forEach(([concept, files]) => {
    if (files.length > 1) {
      nodes.push({ id: `concept:${concept}`, label: concept, group: 'concept', company: 'global', val: 8 });
      files.forEach(f => links.push({ source: f.fileId, target: `concept:${concept}`, keyword: concept }));
    }
  });
  res.json({ nodes, links });
});

v1Router.get('/intelligence/insights', async (req, res) => {
  const { fileId } = req.query;
  if (!fileId) return res.status(400).json({ error: 'Missing fileId' });
  const graph = globalState.knowledgeGraph;
  const file = graph.files[fileId];
  if (!file) return res.json({ keywords: [], related: [] });
  try {
    const vector = await getEmbedding(file.content.slice(0, 1000));
    const semanticMatches = db.prepare(`SELECT m.file_id, m.chunk_text, v.distance FROM vec_chunks v JOIN chunks_metadata m ON v.id = m.id WHERE v.vector MATCH ? AND k = 5 AND m.file_id != ? ORDER BY distance`).all(new Float32Array(vector), fileId);
    const related = semanticMatches.map(m => ({ fileId: m.file_id, company: m.file_id.split('/')[0], sharedKeyword: 'semantic similarity' }));
    res.json({ keywords: file.keywords, related });
  } catch (e) { res.json({ keywords: file.keywords, related: [] }); }
});

v1Router.get('/intelligence/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const results = globalState.searchIndex.search(q, { limit: 10 });
  res.json(results.map(id => ({ id, ...globalState.knowledgeGraph.files[id] })));
});

v1Router.post('/intelligence/semantic-search', validateBody(schemas.semanticSearchSchema), async (req, res) => {
  const { q, limit } = req.body;
  try {
    const vector = await getEmbedding(q);
    const results = db.prepare(`SELECT m.file_id, m.chunk_text, v.distance FROM vec_chunks v JOIN chunks_metadata m ON v.id = m.id WHERE v.vector MATCH ? AND k = ? ORDER BY distance`).all(new Float32Array(vector), limit);
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

v1Router.post('/intelligence/drill', aiRateLimiter, validateBody(schemas.drillRequestSchema), async (req, res) => {
  const { fileId, extraContext } = req.body;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API Key Missing" });
  try {
    const prompt = `You are a Staff Engineer interviewer. Generate ONE high-stakes technical drill.\nContext: ${extraContext || globalState.knowledgeGraph.files[fileId]?.content.slice(0, 3000)}`;
    const text = await generateStructuredContent(prompt, DRILL_SCHEMA);
    res.json(JSON.parse(text));
  } catch (error) { res.status(500).json({ error: error.message }); }
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
        db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(req.userId, `score-${fileId}`, JSON.stringify({ lastScore: numericScore }));
        db.prepare(`INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) VALUES (?, 'drill', ?, ?, ?, ?, ?)`).run(req.userId, fileId, question, userAnswer, text, numericScore);
      }
    }
    res.json(json);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

v1Router.post('/intelligence/incident', aiRateLimiter, validateBody(schemas.incidentRequestSchema), async (req, res) => {
  const { moduleIds } = req.body;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API Key Missing" });
  let context = moduleIds.map(id => globalState.knowledgeGraph.files[id]?.content.slice(0, 1000)).join('\n\n') || "General System Architecture";
  try {
    const prompt = `You are a Chaos Engineering simulator for a Staff Engineer. Context: ${context}. Generate a critical production incident (P0/P1) based on this architecture.`;
    const text = await generateStructuredContent(prompt, INCIDENT_SCHEMA);
    res.json(JSON.parse(text));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

v1Router.post('/intelligence/incident/evaluate', aiRateLimiter, validateBody(schemas.incidentEvaluateSchema), async (req, res) => {
  const { userAnswer, incident } = req.body;
  try {
    const prompt = `Staff Engineer Incident Post-Mortem.\nIncident: ${incident.title}\nActual Root Cause: ${incident.rootCause}\nIdeal Mitigation: ${incident.idealMitigation}\nCandidate's Response: "${userAnswer}"`;
    const text = await generateStructuredContent(prompt, POST_MORTEM_SCHEMA);
    const json = JSON.parse(text);
    if (json && json.score) {
      const numericScore = parseInt(json.score.split('/')[0]);
      db.prepare(`INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) VALUES (?, 'incident', ?, ?, ?, ?, ?)`).run(req.userId, incident.title, incident.title, userAnswer, text, isNaN(numericScore) ? 0 : numericScore);
    }
    res.json(json);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

v1Router.get('/dossier/:companyId', async (req, res) => {
  const fsNative = require('fs').promises;
  const matter = require('gray-matter');
  const { parsePlaybook, parseChecklist } = require('./lib/harvester');
  const companyDir = path.join(INTELLIGENCE_DIR, req.params.companyId);
  try {
    const files = await fsNative.readdir(companyDir);
    const modules = await Promise.all(files.filter(f => f.endsWith('.md')).map(async (fileName) => {
      const fileContent = await fsNative.readFile(path.join(companyDir, fileName), 'utf-8');
      const { data, content } = matter(fileContent);
      let processedData = content;
      if (data.type === 'playbook') processedData = parsePlaybook(content);
      if (data.type === 'checklist') processedData = parseChecklist(content);
      return { id: fileName.replace('.md', '').toLowerCase(), fullId: `${req.params.companyId}/${fileName}`, label: data.label || fileName.replace('.md', ''), type: data.type || 'markdown', icon: data.icon || 'FileText', data: data.data || processedData };
    }));
    res.json({ id: req.params.companyId, name: req.params.companyId.toUpperCase(), modules: modules.sort((a, b) => a.id.localeCompare(b.id)) });
  } catch (e) {
    res.status(404).json({ error: "Company dossier not found" });
  }
});

v1Router.get('/companies', async (req, res) => {
  const fsNative = require('fs').promises;
  const entries = await fsNative.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
  res.json(entries.filter(d => d.isDirectory()).map(d => ({ id: d.name, name: d.name.toUpperCase() })));
});

v1Router.get('/intelligence/history', (req, res) => {
  const rows = db.prepare("SELECT * FROM interaction_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50").all(req.userId);
  res.json(rows.map(r => ({ ...r, evaluation: JSON.parse(r.evaluation) })));
});

v1Router.get('/state/:key', (req, res) => {
  const row = db.prepare("SELECT value FROM user_state WHERE user_id = ? AND key = ?").get(req.userId, req.params.key);
  res.json({ value: row ? JSON.parse(row.value) : null });
});

v1Router.post('/state/:key', (req, res) => {
  db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(req.userId, req.params.key, JSON.stringify(req.body.value));
  res.json({ success: true });
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
  res.status(err.status || 500).json({ error: "Internal Server Error", message: env.NODE_ENV !== 'production' ? err.message : "An unexpected error occurred.", requestId: req.id });
});

const server = app.listen(PORT, () => {
  logger.info(`Intelligence Engine ACTIVE on ${PORT}`);
  spawnRAGWorker();
});

function gracefulShutdown() {
  logger.info("🛑 Signal received. Shutting down gracefully...");
  server.close(() => { logger.info("📡 Express server closed."); db.close(); logger.info("🗄️ SQLite connection closed."); process.exit(0); });
  setTimeout(() => { logger.error("⚠️ Forcefully shutting down."); process.exit(1); }, 10000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
