const express = require('express');
const { db, isPostgres } = require('../lib/db');
const { validateBody, validateQuery, schemas } = require('../lib/validation');
const { globalState } = require('../lib/state');
const { AppError, asyncHandler } = require('../lib/errors');
const {
  DEFAULT_MODEL,
  generateStructuredContent,
  getEmbedding,
  getCircuitState,
  DRILL_SCHEMA,
  INCIDENT_SCHEMA,
  EVAL_SCHEMA,
  GEMINI_API_KEY,
} = require('../lib/intelligence');

const router = express.Router();

const rateLimit = require('express-rate-limit');
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req) => req.userId || req.ip,
  message: {
    error: 'AI Intelligence Engine is cooling down for your account. Please wait 60 seconds.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

/**
 * @openapi
 * /intelligence/stream:
 *   get:
 *     tags: [Intelligence Engine]
 *     summary: Real-time system event stream (SSE)
 */
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const clientId = Date.now();
  globalState.clients.push({ id: clientId, res });
  res.write(':ok\n\n');

  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    globalState.clients = globalState.clients.filter((c) => c.id !== clientId);
  });
});

/**
 * @openapi
 * /intelligence/stats:
 *   get:
 *     tags: [Intelligence Engine]
 *     summary: Retrieve system-wide intelligence telemetry
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    req.log.info('📊 [Intelligence] Fetching system telemetry');
    let chunksCount = 0,
      historyCount = 0,
      learnedCount = 0;

    try {
      if (isPostgres) {
        const [chunksRes, historyRes, learnedRes] = await Promise.all([
          db.query('SELECT count(*) as count FROM chunks_metadata'),
          db.query('SELECT count(*) as count FROM interaction_history'),
          db.query("SELECT count(*) as count FROM dossiers WHERE company = 'user'"),
        ]);
        chunksCount = parseInt(chunksRes.rows[0].count);
        historyCount = parseInt(historyRes.rows[0].count);
        learnedCount = parseInt(learnedRes.rows[0].count);
      } else {
        const tables = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chunks_metadata'")
          .get();
        if (tables) {
          chunksCount = db.prepare('SELECT count(*) as count FROM chunks_metadata').get().count;
          historyCount = db
            .prepare('SELECT count(*) as count FROM interaction_history')
            .get().count;
          learnedCount = db
            .prepare("SELECT count(*) as count FROM chunks_metadata WHERE file_id LIKE 'learned/%'")
            .get().count;
        }
      }
    } catch (e) {
      req.log.warn({ error: e.message }, '⚠️ Stats requested before full table initialization');
    }

    res.success({
      totalChunks: chunksCount,
      interactions: historyCount,
      learnedAssets: learnedCount,
      model: DEFAULT_MODEL,
      uptime: process.uptime(),
      env: process.env.NODE_ENV || 'development',
      auth: process.env.AUTH_ENABLED === 'true' ? 'enabled' : 'disabled',
      aiEngine: {
        circuitState: getCircuitState(),
      },
      isSyncing: globalState.isSyncing,
    });
  })
);

/**
 * @openapi
 * /intelligence/graph:
 *   get:
 *     tags: [Intelligence Engine]
 *     summary: Generate the 3D Architectural Nervous System data
 */
router.get(
  '/graph',
  asyncHandler(async (req, res) => {
    req.log.info('🕸️ [Intelligence] Generating 3D knowledge map');
    const nodes = [];
    const links = [];
    let userRows;

    if (isPostgres) {
      const res = await db.query(
        "SELECT key, value FROM user_state WHERE user_id = $1 AND (key LIKE 'tracker-%' OR key LIKE 'score-%')",
        [req.userId]
      );
      userRows = res.rows;
    } else {
      userRows = db
        .prepare(
          "SELECT key, value FROM user_state WHERE user_id = ? AND (key LIKE 'tracker-%' OR key LIKE 'score-%')"
        )
        .all(req.userId);
    }

    const trackers = {};
    const scores = {};
    userRows.forEach((row) => {
      const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (row.key.startsWith('tracker-')) trackers[row.key] = val;
      if (row.key.startsWith('score-')) scores[row.key.replace('score-', '')] = val;
    });

    Object.entries(globalState.knowledgeGraph.files).forEach(([id, data]) => {
      const trackerKey = `tracker-${data.company}-${id.split('/').pop().replace('.md', '').toLowerCase()}`;
      const moduleTasks = trackers[trackerKey] || [];
      const trackerReadiness =
        moduleTasks.length > 0
          ? (moduleTasks.filter((t) => t.done).length / moduleTasks.length) * 0.5
          : 0;
      const moduleScore = scores[id]?.lastScore || 0;
      const readiness = trackerReadiness + (moduleScore / 10) * 0.5;
      nodes.push({
        id,
        label: data.label,
        group: 'module',
        company: data.company,
        val: 15,
        readiness,
        blastRadius: data.keywords.length,
      });
    });

    Object.entries(globalState.knowledgeGraph.concepts).forEach(([concept, files]) => {
      if (files.length > 1) {
        nodes.push({
          id: `concept:${concept}`,
          label: concept,
          group: 'concept',
          company: 'global',
          val: 8,
        });
        files.forEach((f) =>
          links.push({ source: f.fileId, target: `concept:${concept}`, keyword: concept })
        );
      }
    });
    res.success({ nodes, links });
  })
);

/**
 * @openapi
 * /intelligence/insights:
 *   get:
 *     tags: [Intelligence Engine]
 *     summary: Retrieve contextual keywords and related semantic links
 */
router.get(
  '/insights',
  validateQuery(schemas.insightsQuerySchema),
  asyncHandler(async (req, res) => {
    const { fileId: rawFileId } = req.query;
    const fileId = String(rawFileId).toLowerCase();
    const file = globalState.knowledgeGraph.files[fileId];
    if (!file) return res.success({ keywords: [], related: [] });

    try {
      const vector = await getEmbedding(file.content.slice(0, 1000));
      let related;
      if (isPostgres) {
        const dbRes = await db.query(
          'SELECT m.file_id, m.chunk_text, (m.embedding <=> $1) as distance FROM chunks_metadata m WHERE m.file_id != $2 ORDER BY distance LIMIT 5',
          [JSON.stringify(vector), fileId]
        );
        related = dbRes.rows.map((m) => ({
          fileId: m.file_id,
          company: m.file_id.split('/')[0],
          sharedKeyword: 'semantic similarity',
        }));
      } else {
        const semanticMatches = db
          .prepare(
            `SELECT m.file_id, m.chunk_text, v.distance 
             FROM vec_chunks v 
             JOIN chunks_metadata m ON v.id = m.id 
             WHERE v.vector MATCH ? 
             AND k = 5 
             AND m.file_id != ? 
             ORDER BY distance`
          )
          .all(new Float32Array(vector), fileId);
        related = semanticMatches.map((m) => ({
          fileId: m.file_id,
          company: m.file_id.split('/')[0],
          sharedKeyword: 'semantic similarity',
        }));
      }
      res.success({ keywords: file.keywords, related });
    } catch {
      res.success({ keywords: file.keywords, related: [] });
    }
  })
);

/**
 * @openapi
 * /intelligence/search:
 *   get:
 *     tags: [Intelligence Engine]
 *     summary: Perform a high-speed keyword search
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 */
router.get(
  '/search',
  validateQuery(schemas.searchQuerySchema),
  asyncHandler(async (req, res) => {
    const { q } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    if (!q) return res.success([]);

    const results = globalState.searchIndex.search(q, { limit: limit + offset });
    const paginatedResults = results.slice(offset);

    res.success(paginatedResults.map((id) => ({ id, ...globalState.knowledgeGraph.files[id] })));
  })
);

/**
 * @openapi
 * /intelligence/semantic-search:
 *   post:
 *     tags: [Intelligence Engine]
 *     summary: Deep vector search
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [q]
 *             properties:
 *               q:
 *                 type: string
 *                 minLength: 1
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 */
router.post(
  '/semantic-search',
  validateBody(schemas.semanticSearchSchema),
  asyncHandler(async (req, res) => {
    const { q, limit } = req.body;
    try {
      const vector = await getEmbedding(q);
      let results;
      if (isPostgres) {
        const dbRes = await db.query(
          'SELECT m.file_id, m.chunk_text, (m.embedding <=> $1) as distance FROM chunks_metadata m ORDER BY distance LIMIT $2',
          [JSON.stringify(vector), limit]
        );
        results = dbRes.rows;
      } else {
        results = db
          .prepare(
            `SELECT m.file_id, m.chunk_text, v.distance 
             FROM vec_chunks v 
             JOIN chunks_metadata m ON v.id = m.id 
             WHERE v.vector MATCH ? 
             AND k = ? 
             ORDER BY distance`
          )
          .all(new Float32Array(vector), limit);
      }
      res.success(results);
    } catch (e) {
      throw new AppError(e.message, 500);
    }
  })
);

/**
 * @openapi
 * /intelligence/drill:
 *   post:
 *     tags: [Intelligence Engine]
 *     summary: Generate a high-stakes technical drill
 */
router.post(
  '/drill',
  aiRateLimiter,
  validateBody(schemas.drillRequestSchema),
  asyncHandler(async (req, res) => {
    const { fileId, extraContext = '' } = req.body;
    if (!GEMINI_API_KEY) throw new AppError('AI Intelligence Engine Offline', 503);

    try {
      const context =
        extraContext ||
        globalState.knowledgeGraph.files[fileId.toLowerCase()]?.content.slice(0, 3000) ||
        'General System Architecture';
      const prompt = `You are a Staff Engineer interviewer. Generate ONE high-stakes technical drill.\nContext: ${context}`;
      const text = await generateStructuredContent(prompt, DRILL_SCHEMA);
      res.success(JSON.parse(text));
    } catch (error) {
      throw new AppError(error.message, 500);
    }
  })
);

/**
 * @openapi
 * /intelligence/incident:
 *   post:
 *     tags: [Intelligence Engine]
 *     summary: Simulate a critical production incident
 */
router.post(
  '/incident',
  aiRateLimiter,
  validateBody(schemas.incidentRequestSchema),
  asyncHandler(async (req, res) => {
    const { moduleIds = [] } = req.body;
    if (!GEMINI_API_KEY) throw new AppError('AI Intelligence Engine Offline', 503);

    let context =
      moduleIds
        .map((id) => globalState.knowledgeGraph.files[id.toLowerCase()]?.content.slice(0, 1000))
        .join('\n\n') || 'General System Architecture';

    try {
      const prompt = `You are a Chaos Engineering simulator for a Staff Engineer. Context: ${context}. Generate a critical production incident (P0/P1) based on this architecture.`;
      const text = await generateStructuredContent(prompt, INCIDENT_SCHEMA);
      res.success(JSON.parse(text));
    } catch (error) {
      throw new AppError(error.message, 500);
    }
  })
);

/**
 * @openapi
 * /intelligence/evaluate:
 *   post:
 *     tags: [Intelligence Engine]
 *     summary: AI-driven evaluation of candidate response
 */
router.post(
  '/evaluate',
  aiRateLimiter,
  validateBody(schemas.evaluateRequestSchema),
  asyncHandler(async (req, res) => {
    const { userAnswer, question, idealResponse, fileId } = req.body;
    try {
      const prompt = `Staff Interview Evaluation. Q: ${question}\nIdeal: ${idealResponse}\nCandidate: "${userAnswer}"`;
      const text = await generateStructuredContent(prompt, EVAL_SCHEMA);
      const json = JSON.parse(text);
      if (json && json.score && fileId) {
        const numericScore = parseInt(json.score.split('/')[0]);
        if (!isNaN(numericScore)) {
          if (isPostgres) {
            await db.query(
              'INSERT INTO user_state (user_id, key, value) VALUES ($1, $2, $3) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP',
              [req.userId, `score-${fileId}`, JSON.stringify({ lastScore: numericScore })]
            );
            await db.query(
              "INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) VALUES ($1, 'drill', $2, $3, $4, $5, $6)",
              [req.userId, fileId, question, userAnswer, text, numericScore]
            );
          } else {
            db.prepare(
              `INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`
            ).run(req.userId, `score-${fileId}`, JSON.stringify({ lastScore: numericScore }));
            db.prepare(
              `INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) VALUES (?, 'drill', ?, ?, ?, ?, ?)`
            ).run(req.userId, fileId, question, userAnswer, text, numericScore);
          }
        }
      }
      res.success(json);
    } catch (error) {
      throw new AppError(error.message, 500);
    }
  })
);

module.exports = router;
