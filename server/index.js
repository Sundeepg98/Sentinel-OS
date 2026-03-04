const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, initDB } = require('./lib/db');
const { 
  GEMINI_API_KEY, 
  DEFAULT_MODEL, 
  generateContent, 
  extractJson, 
  getEmbedding 
} = require('./lib/intelligence');
const { 
  syncIntelligence, 
  knowledgeGraph, 
  searchIndex, 
  INTELLIGENCE_DIR 
} = require('./lib/harvester');

const app = express();
const PORT = process.env.PORT || 3002;
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');

// Initialize Core Systems
initDB();
app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIST));

// Auth Middleware (No-Blocker Strategy)
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
const authGuard = (req, res, next) => {
  req.userId = 'local-admin'; // Default for Local/Staging
  next();
};
app.use(authGuard);

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
  } catch (e) { console.error("Feedback Loop Error:", e.message); }
}

// --- API ENDPOINTS ---

app.get('/api/intelligence/stats', (req, res) => {
  const chunks = db.prepare("SELECT count(*) as count FROM chunks_metadata").get();
  const history = db.prepare("SELECT count(*) as count FROM interaction_history").get();
  const learned = db.prepare("SELECT count(*) as count FROM chunks_metadata WHERE file_id LIKE 'learned/%'").get();
  res.json({
    totalChunks: chunks.count,
    interactions: history.count,
    learnedAssets: learned.count,
    model: DEFAULT_MODEL,
    uptime: process.uptime()
  });
});

app.get('/api/intelligence/history', (req, res) => {
  const history = db.prepare("SELECT * FROM interaction_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50").all(req.userId);
  res.json(history.map(h => ({ ...h, evaluation: JSON.parse(h.evaluation) })));
});

app.get('/api/intelligence/graph', (req, res) => {
  const nodes = []; const links = [];
  const rows = db.prepare("SELECT key, value FROM user_state WHERE user_id = ? AND (key LIKE 'tracker-%' OR key LIKE 'score-%')").all(req.userId);
  const trackers = {}; const scores = {};
  rows.forEach(row => {
    if (row.key.startsWith('tracker-')) trackers[row.key] = JSON.parse(row.value);
    if (row.key.startsWith('score-')) scores[row.key.replace('score-', '')] = JSON.parse(row.value);
  });

  const learnedModules = db.prepare("SELECT DISTINCT file_id, metadata FROM chunks_metadata WHERE file_id LIKE 'learned/%'").all();

  Object.entries(knowledgeGraph.files).forEach(([id, data]) => {
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

  Object.entries(knowledgeGraph.concepts).forEach(([concept, files]) => {
    if (files.length > 1) {
      nodes.push({ id: `concept:${concept}`, label: concept, group: 'concept', company: 'global', val: 8 });
      files.forEach(f => links.push({ source: f.fileId, target: `concept:${concept}`, keyword: concept }));
    }
  });
  res.json({ nodes, links });
});

app.post('/api/intelligence/semantic-search', async (req, res) => {
  const { q, limit = 5 } = req.body;
  try {
    const vector = await getEmbedding(q);
    const results = db.prepare(`SELECT m.file_id, m.chunk_text, v.distance FROM vec_chunks v JOIN chunks_metadata m ON v.id = m.id WHERE v.vector MATCH ? AND k = ? ORDER BY distance`).all(new Float32Array(vector), limit);
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/intelligence/drill', async (req, res) => {
  const { fileId, extraContext = "" } = req.body;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API Key Missing" });
  try {
    const prompt = `You are a Staff Engineer interviewer. Generate ONE high-stakes technical drill.\nContext: ${extraContext || knowledgeGraph.files[fileId]?.content.slice(0, 3000)}\nRespond ONLY in JSON: { "question": "...", "idealResponse": "..." }`;
    const text = await generateContent(prompt);
    res.json(extractJson(text) || { error: "Failed to parse AI response" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/intelligence/evaluate', async (req, res) => {
  const { userAnswer, question, idealResponse, fileId } = req.body;
  try {
    const prompt = `Staff Interview Evaluation. Q: ${question}\nIdeal: ${idealResponse}\nCandidate: "${userAnswer}"\nEvaluate in JSON: { "score": "X/10", "feedback": "...", "followUp": "..." }`;
    const text = await generateContent(prompt);
    const json = extractJson(text);
    if (json && json.score && fileId) {
      const numericScore = parseInt(json.score.split('/')[0]);
      if (!isNaN(numericScore)) {
        db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(req.userId, `score-${fileId}`, JSON.stringify({ lastScore: numericScore }));
        db.prepare(`INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) VALUES (?, 'drill', ?, ?, ?, ?, ?)`).run(req.userId, fileId, question, userAnswer, JSON.stringify(json), numericScore);
        learnFromProposal(req.userId, fileId, userAnswer, numericScore);
      }
    }
    res.json(json || { score: "N/A", feedback: text });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Other Standard Endpoints
app.get('/api/companies', async (req, res) => {
  const fsNative = require('fs').promises;
  const entries = await fsNative.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
  res.json(entries.filter(d => d.isDirectory()).map(d => ({ id: d.name, name: d.name.toUpperCase() })));
});

app.get('/api/dossier/:companyId', async (req, res) => {
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

app.get('/api/state/:key', (req, res) => {
  const row = db.prepare("SELECT value FROM user_state WHERE user_id = ? AND key = ?").get(req.userId, req.params.key);
  res.json({ value: row ? JSON.parse(row.value) : null });
});

app.post('/api/state/:key', (req, res) => {
  db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(req.userId, req.params.key, JSON.stringify(req.body.value));
  res.json({ success: true });
});

app.get(/(.*)/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
app.listen(PORT, () => {
  console.log(`Intelligence Engine ACTIVE on ${PORT}`);
  setTimeout(syncIntelligence, 500);
});
