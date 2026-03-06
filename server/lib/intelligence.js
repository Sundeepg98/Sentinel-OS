const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const fs = require('fs').promises;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = "gemini-2.5-flash"; 
const EMBEDDING_MODEL = "gemini-embedding-001";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');

// --- 🛡️ ENGINEERING BASIC: CIRCUIT BREAKER ---
const AI_CIRCUIT = {
  state: 'CLOSED', // 'CLOSED', 'OPEN', 'HALF_OPEN'
  failures: 0,
  threshold: 5,
  cooldown: 30000, // 30 seconds
  lastFailureTime: null
};

function checkCircuit() {
  if (AI_CIRCUIT.state === 'OPEN') {
    const elapsed = Date.now() - AI_CIRCUIT.lastFailureTime;
    if (elapsed > AI_CIRCUIT.cooldown) {
      AI_CIRCUIT.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  return true;
}

function recordAiSuccess() {
  AI_CIRCUIT.failures = 0;
  AI_CIRCUIT.state = 'CLOSED';
}

function recordAiFailure() {
  AI_CIRCUIT.failures++;
  AI_CIRCUIT.lastFailureTime = Date.now();
  if (AI_CIRCUIT.failures >= AI_CIRCUIT.threshold) {
    AI_CIRCUIT.state = 'OPEN';
    console.error(`🚨 AI CIRCUIT BREAKER TRIGGERED: Open for ${AI_CIRCUIT.cooldown}ms`);
  }
}

// SCHEMAS
const DRILL_SCHEMA = {
  type: "object",
  properties: {
    question: { type: "string" },
    idealResponse: { type: "string" }
  },
  required: ["question", "idealResponse"]
};

const INCIDENT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    logs: { type: "array", items: { type: "string" } },
    rootCause: { type: "string" },
    idealMitigation: { type: "string" }
  },
  required: ["title", "description", "logs", "rootCause", "idealMitigation"]
};

const EVAL_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "string" },
    feedback: { type: "string" },
    followUp: { type: "string" }
  },
  required: ["score", "feedback"]
};

const POST_MORTEM_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "string" },
    feedback: { type: "string" },
    missedSteps: { type: "array", items: { type: "string" } }
  },
  required: ["score", "feedback"]
};

async function logAiFailure(type, prompt, error) {
  const { db, isPostgres } = require('./db');
  
  try {
    const entry = {
      type: 'AI',
      category: type,
      message: error.message || String(error),
      payload: prompt,
      stack: error.stack
    };

    if (isPostgres) {
      await db.query(
        "INSERT INTO system_logs (type, category, message, payload, stack) VALUES ($1, $2, $3, $4, $5)",
        [entry.type, entry.category, entry.message, entry.payload, entry.stack]
      );
    } else {
      db.prepare(
        "INSERT INTO system_logs (type, category, message, payload, stack) VALUES (?, ?, ?, ?, ?)"
      ).run(entry.type, entry.category, entry.message, entry.payload, entry.stack);
    }
  } catch (e) {
    console.error("❌ Failed to write AI failure log to DB:", e.message);
  }
}

async function generateStructuredContent(prompt, schema) {
  if (!checkCircuit()) {
    throw new Error("AI Intelligence Engine is temporarily offline (Circuit Breaker Active).");
  }

  const model = genAI.getGenerativeModel({ 
    model: DEFAULT_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });
  
  try {
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    recordAiSuccess();
    return text;
  } catch (error) {
    recordAiFailure();
    await logAiFailure("generation", prompt, error);
    throw error;
  }
}

async function getEmbedding(text) {
  if (!GEMINI_API_KEY) return new Array(3072).fill(0);
  try {
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT"
    });
    return result.embedding.values;
  } catch (e) {
    console.error('Embedding Error:', e.message);
    return new Array(3072).fill(0);
  }
}

module.exports = { 
  getEmbedding, 
  generateStructuredContent,
  logAiFailure,
  DRILL_SCHEMA,
  INCIDENT_SCHEMA,
  EVAL_SCHEMA,
  POST_MORTEM_SCHEMA,
  DEFAULT_MODEL, 
  EMBEDDING_MODEL,
  GEMINI_API_KEY,
  getCircuitState: () => AI_CIRCUIT.state
};
