const express = require('express');
const cors = require('cors');
const path = require('path');
const { Worker } = require('worker_threads');
const { Index } = require('flexsearch');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
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

/**
 * 🛠️ ENGINEERING BASIC: PERFORMANCE & SECURITY
 */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression()); // Gzip compression for faster asset delivery

/**
 * 🛠️ ENGINEERING BASIC: REQUEST CORRELATION
 */
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Use Morgan with Request ID for traceability
morgan.token('id', (req) => req.id);
app.use(morgan(':id :method :url :status :res[content-length] - :response-time ms'));

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), requestId: req.id });
});

// --- 🛠️ ENGINEERING BASIC: API VERSIONING (v1) ---
const v1Router = express.Router();

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 15, 
  message: { error: "AI Intelligence Engine is cooling down. Please wait 60 seconds." },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- SYNCED STATE (Main Thread) ---
let knowledgeGraph = { concepts: {}, files: {} };
let searchIndex = new Index({ preset: 'score', tokenize: 'forward' });

// --- RAG WORKER ISOLATION ---
let isSyncing = false;
function spawnRAGWorker() {
  if (isSyncing) return;
  isSyncing = true;
  
  const worker = new Worker(path.join(__dirname, 'lib', 'rag-worker.js'));
  
  worker.on('message', (msg) => {
    if (msg.status === 'complete') {
      logger.info(`📡 Intelligence Hydrated from Worker (${msg.duration}s)`);
      knowledgeGraph = msg.knowledgeGraph;
      
      const newIndex = new Index({ preset: 'score', tokenize: 'forward' });
      Object.entries(knowledgeGraph.files).forEach(([id, file]) => {
        newIndex.add(id, file.content);
      });
      searchIndex = newIndex;
      logger.info(`🔍 Search Index Synchronized.`);
      isSyncing = false;
    }
  });

  worker.on('error', (err) => {
    logger.error('🧵 Worker Error:', err);
    isSyncing = false;
  });

  worker.on('exit', () => { isSyncing = false; });
}

// --- INTELLIGENCE FEEDBACK LOOP ---
let dynamicChunkId = 999000; 
async function learnFromProposal(userId, fileId, text, score) {
  if (score < 8) return; 
  try {
    const vector = await getEmbedding(text);
    const meta = { learned: true, contributor: userId, originalModule: fileId, timestamp: new Date().toISOString() };
    db.transaction(() => {
      const rowid = dynamicChunkId++;
      db.prepare(`INSERT INTO chunks_metadata (id, file_id, chunk_text, metadata) VALUES (?, ?, ?, ?)`).run(rowid, `learned/${fileId}`, text, JSON.stringify(meta));
      db.prepare(`INSERT INTO vec_chunks (id, vector) VALUES (?, ?)`).run(rowid, new Float32Array(vector));
    })();
    logger.info(`🧠 Learned from proposal in ${fileId}`);
  } catch (e) { logger.error("Feedback Loop Error:", e.message); }
}

// Auth Middleware (No-Blocker Strategy)
const authGuard = (req, res, next) => {
  req.userId = 'local-admin'; 
  next();
};

v1Router.use(authGuard);

// --- API V1 ENDPOINTS ---

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
  const graph = getKnowledgeGraph();

  Object.entries(graph.files).forEach(([id, data]) => {
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

  Object.entries(graph.concepts).forEach(([concept, files]) => {
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
  const graph = getKnowledgeGraph();
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
  const results = searchIndex.search(q, { limit: 10 });
  res.json(results.map(id => ({ id, ...knowledgeGraph.files[id] })));
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
  const graph = getKnowledgeGraph();
  try {
    const prompt = `You are a Staff Engineer interviewer. Generate ONE high-stakes technical drill.\nContext: ${extraContext || graph.files[fileId]?.content.slice(0, 3000)}`;
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
        learnFromProposal(req.userId, fileId, userAnswer, numericScore);
      }
    }
    res.json(json);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

v1Router.post('/intelligence/incident', aiRateLimiter, validateBody(schemas.incidentRequestSchema), async (req, res) => {
  const { moduleIds } = req.body;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API Key Missing" });
  const graph = getKnowledgeGraph();
  let context = moduleIds.map(id => graph.files[id]?.content.slice(0, 1000)).join('\n\n') || "General System Architecture";
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

v1Router.get('/portfolio/export', (req, res) => {
  const rows = db.prepare("SELECT key, value FROM user_state WHERE user_id = ?").all(req.userId);
  let md = `# Staff Engineer Architectural Portfolio\n\n*Generated by Sentinel-OS*\n\n---\n\n## 🏆 Readiness & Mastery Tracker\n\n`;
  let hasTrackers = false;
  rows.forEach(row => {
    if (row.key.startsWith('tracker-')) {
      try {
        const tasks = JSON.parse(row.value);
        if (tasks && tasks.length > 0) {
          hasTrackers = true;
          const parts = row.key.split('-');
          md += `### ${parts[1].toUpperCase()} - ${parts.slice(2).join('-').toUpperCase()}\n`;
          tasks.forEach(t => { md += `- [${t.done ? 'x' : ' '}] ${t.text}\n`; });
          md += `\n`;
        }
      } catch (e) {}
    }
  });
  if (!hasTrackers) md += `*No tracker data recorded yet.*\n\n`;
  md += `## 🧠 AI Drill Evaluations\n\n`;
  let hasScores = false;
  rows.forEach(row => {
    if (row.key.startsWith('score-')) {
      try {
        const data = JSON.parse(row.value);
        if (data && data.lastScore) {
          hasScores = true;
          md += `### Module: ${row.key.replace('score-', '')}\n- **Highest Score**: ${data.lastScore}/10\n\n`;
        }
      } catch (e) {}
    }
  });
  if (!hasScores) md += `*No AI drill scores recorded yet.*\n\n`;
  md += `---\n*End of Report*\n`;
  res.setHeader('Content-Type', 'text/markdown');
  res.send(md);
});

// --- MOUNT VERSIONED API ---
app.use('/api/v1', v1Router);

app.use(express.static(FRONTEND_DIST, {
  maxAge: '1y',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.get(/(.*)/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));

/**
 * 🛠️ ENGINEERING BASIC: GLOBAL ERROR HANDLER
 */
app.use((err, req, res, next) => {
  logger.error({ 
    id: req.id,
    path: req.path,
    message: err.message,
    stack: env.NODE_ENV !== 'production' ? err.stack : undefined
  }, '💥 Unhandled Server Error');

  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: env.NODE_ENV !== 'production' ? err.message : "An unexpected error occurred.",
    requestId: req.id
  });
});

const server = app.listen(PORT, () => {
  logger.info(`Intelligence Engine ACTIVE on ${PORT}`);
  spawnRAGWorker();
});

function gracefulShutdown() {
  logger.info("🛑 Signal received. Shutting down gracefully...");
  server.close(() => {
    logger.info("📡 Express server closed.");
    db.close();
    logger.info("🗄️ SQLite connection closed.");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("⚠️ Forcefully shutting down.");
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
