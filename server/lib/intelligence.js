const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = "gemini-2.5-flash"; 
const EMBEDDING_MODEL = "gemini-embedding-001";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');

function extractJson(text) {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const jsonStr = cleaned.substring(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn("AI JSON Extraction failed:", e.message);
    return null;
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

async function generateContent(prompt) {
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
  const result = await model.generateContent(prompt);
  return (await result.response).text();
}

module.exports = { 
  getEmbedding, 
  generateContent, 
  extractJson, 
  DEFAULT_MODEL, 
  EMBEDDING_MODEL,
  GEMINI_API_KEY
};
