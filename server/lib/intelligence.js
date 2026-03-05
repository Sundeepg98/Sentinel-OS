const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = "gemini-2.5-flash"; 
const EMBEDDING_MODEL = "gemini-embedding-001";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');

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
  const logPath = path.join(__dirname, '..', 'logs', 'ai-failures.json');
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    prompt,
    error: error.message || error,
    stack: error.stack
  };
  
  try {
    let currentLogs = [];
    try {
      const data = await fs.readFile(logPath, 'utf-8');
      currentLogs = JSON.parse(data);
    } catch (e) {
      // File doesn't exist yet, start new array
    }
    currentLogs.push(entry);
    // Keep only last 100 failures
    if (currentLogs.length > 100) currentLogs = currentLogs.slice(-100);
    await fs.writeFile(logPath, JSON.stringify(currentLogs, null, 2));
  } catch (e) {
    console.error("Failed to write AI failure log:", e.message);
  }
}

async function generateStructuredContent(prompt, schema) {
  const model = genAI.getGenerativeModel({ 
    model: DEFAULT_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });
  
  try {
    const result = await model.generateContent(prompt);
    return (await result.response).text();
  } catch (error) {
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
  GEMINI_API_KEY
};
