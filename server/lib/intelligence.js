const { GoogleGenerativeAI } = require('@google/generative-ai');
const LRUCache = require('lru-cache');
const logger = require('./logger');
const config = require('./config');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = config.AI.DEFAULT_MODEL;
const EMBEDDING_MODEL = config.AI.EMBEDDING_MODEL;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');

// --- 🛡️ ENGINEERING BASIC: AI RESPONSE CACHE ---
const aiCache = new LRUCache({
  max: 500, // Store up to 500 unique AI responses
  ttl: 1000 * 60 * 60, // 1 hour time-to-live
});

// --- 🛡️ ENGINEERING BASIC: CIRCUIT BREAKER ---
const AI_CIRCUIT = {
  state: 'CLOSED',
  failures: 0,
  threshold: config.AI.CIRCUIT_BREAKER.THRESHOLD,
  cooldown: config.AI.CIRCUIT_BREAKER.COOLDOWN_MS,
  lastFailureTime: null,
};

function checkCircuit() {
  if (AI_CIRCUIT.state === 'OPEN') {
    const elapsed = Date.now() - AI_CIRCUIT.lastFailureTime;
    if (elapsed > AI_CIRCUIT.cooldown) {
      AI_CIRCUIT.state = 'HALF_OPEN';
      logger.info('🛡️ AI CIRCUIT HALF-OPEN: Permitting probe request...');
      return true;
    }
    return false;
  }
  // In HALF_OPEN state, we only want one concurrent request to probe.
  // This simple check works well for low-concurrency or as a baseline.
  return true;
}

function recordAiSuccess() {
  if (AI_CIRCUIT.state === 'HALF_OPEN') {
    logger.info('✅ AI CIRCUIT CLOSED: Probe successful, system restored.');
  }
  AI_CIRCUIT.failures = 0;
  AI_CIRCUIT.state = 'CLOSED';
}

function recordAiFailure() {
  AI_CIRCUIT.failures++;
  AI_CIRCUIT.lastFailureTime = Date.now();
  if (AI_CIRCUIT.failures >= AI_CIRCUIT.threshold) {
    AI_CIRCUIT.state = 'OPEN';
    logger.error('🚨 AI CIRCUIT BREAKER TRIGGERED: Blocking generation for 30s');
  }
}

// --- 🛡️ ENGINEERING BASIC: CONTEXT BUDGETING ---
function truncateToBudget(text, limit = config.AI.CONTEXT_BUDGET) {
  if (!text || text.length <= limit) return text;
  return text.substring(0, limit) + '... [Truncated for Token Budget]';
}

// SCHEMAS
const DRILL_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    idealResponse: { type: 'string' },
  },
  required: ['question', 'idealResponse'],
};

const INCIDENT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    logs: { type: 'array', items: { type: 'string' } },
    rootCause: { type: 'string' },
    idealMitigation: { type: 'string' },
  },
  required: ['title', 'description', 'logs', 'rootCause', 'idealMitigation'],
};

const EVAL_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'string' },
    feedback: { type: 'string' },
    followUp: { type: 'string' },
  },
  required: ['score', 'feedback'],
};

const POST_MORTEM_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'string' },
    feedback: { type: 'string' },
    missedSteps: { type: 'array', items: { type: 'string' } },
  },
  required: ['score', 'feedback'],
};

async function logAiFailure(type, prompt, error, userId = null) {
  const { db, isPostgres } = require('./db');
  try {
    const entry = {
      type: 'AI',
      category: type,
      message: error.message || String(error),
      payload: truncateToBudget(prompt, 1000),
      stack: error.stack,
      userId,
    };
    if (isPostgres) {
      await db.query(
        'INSERT INTO system_logs (type, category, message, payload, stack, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [entry.type, entry.category, entry.message, entry.payload, entry.stack, entry.userId]
      );
    } else {
      db.prepare(
        'INSERT INTO system_logs (type, category, message, payload, stack, user_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(entry.type, entry.category, entry.message, entry.payload, entry.stack, entry.userId);
    }
  } catch (e) {
    logger.error({ error: e.message }, '❌ Failed to write AI failure log to DB');
  }
}

async function generateStructuredContent(prompt, schema) {
  // 1. Check Cache
  const cacheKey = `gen:${prompt}:${JSON.stringify(schema)}`;
  if (aiCache.has(cacheKey)) {
    logger.debug({ cacheKey }, '💾 Returning AI result from Cache (Layer 2)');
    return aiCache.get(cacheKey);
  }

  // 2. Check Circuit
  if (!checkCircuit()) {
    throw new Error('AI Intelligence Engine is temporarily offline (Circuit Breaker Active).');
  }

  // 3. Enforce Token Budget
  const budgetedPrompt = truncateToBudget(prompt);

  const model = genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  let lastError;
  for (let attempt = 1; attempt <= config.AI.RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent(budgetedPrompt);
      const text = (await result.response).text();
      recordAiSuccess();
      aiCache.set(cacheKey, text);
      return text;
    } catch (error) {
      lastError = error;
      logger.warn({ attempt, error: error.message }, '⚠️ AI Generation Attempt Failed');
      if (attempt < config.AI.RETRY_ATTEMPTS) {
        await new Promise((res) => setTimeout(res, config.AI.RETRY_DELAY_MS * attempt));
      }
    }
  }

  recordAiFailure();
  await logAiFailure('generation', budgetedPrompt, lastError);
  throw lastError;
}

async function getEmbedding(text) {
  if (!GEMINI_API_KEY) return new Array(3072).fill(0);

  const cacheKey = `emb:${text}`;
  if (aiCache.has(cacheKey)) return aiCache.get(cacheKey);

  try {
    const budgetedText = truncateToBudget(text, 5000);
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent({
      content: { parts: [{ text: budgetedText }] },
      taskType: 'RETRIEVAL_DOCUMENT',
    });
    const vector = result.embedding.values;
    aiCache.set(cacheKey, vector);
    return vector;
  } catch (e) {
    logger.error({ error: e.message }, '🧵 Embedding Error');
    return new Array(3072).fill(0);
  }
}

module.exports = {
  getEmbedding,
  generateStructuredContent,
  truncateToBudget,
  logAiFailure,
  DRILL_SCHEMA,
  INCIDENT_SCHEMA,
  EVAL_SCHEMA,
  POST_MORTEM_SCHEMA,
  DEFAULT_MODEL,
  EMBEDDING_MODEL,
  GEMINI_API_KEY,
  getCircuitState: () => AI_CIRCUIT.state,
  recordAiSuccess,
  recordAiFailure,
};
