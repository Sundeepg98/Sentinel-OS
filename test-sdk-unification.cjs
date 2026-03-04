const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const key = process.env.GEMINI_API_KEY || "AIzaSyD-RPb_Ym57U_tQpO1GkEMpm1QACOrI_4s";

async function testUnification() {
  console.log("=== Sentinel-OS AI Unification Test ===");
  console.log(`API Key: ${key.substring(0, 10)}...`);

  const genAI = new GoogleGenerativeAI(key);

  // --- 1. EMBEDDING TEST ---
  console.log("\n--- 1. Testing Embeddings (gemini-embedding-001) ---");
  
  // A. Raw Axios
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`;
    const res = await axios.post(url, { content: { parts: [{ text: "test" }] }, taskType: "RETRIEVAL_DOCUMENT" });
    console.log(`✅ Raw Axios Success: ${res.data.embedding.values.length} dims`);
  } catch (e) {
    console.log(`❌ Raw Axios Failed: ${e.message}`);
  }

  // B. SDK
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const res = await model.embedContent("test");
    console.log(`✅ SDK Success: ${res.embedding.values.length} dims`);
  } catch (e) {
    console.log(`❌ SDK Failed: ${e.message}`);
  }

  // --- 2. GENERATIVE TEST ---
  console.log("\n--- 2. Testing Generation (gemini-2.5-flash) ---");

  // A. Raw Axios
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await axios.post(url, { contents: [{ parts: [{ text: "say hello" }] }] });
    console.log(`✅ Raw Axios Success: "${res.data.candidates[0].content.parts[0].text.trim()}"`);
  } catch (e) {
    console.log(`❌ Raw Axios Failed: ${e.message}`);
  }

  // B. SDK (Different variations)
  const variations = ["gemini-2.5-flash", "models/gemini-2.5-flash", "gemini-1.5-flash", "models/gemini-1.5-flash"];
  
  for (const v of variations) {
    try {
      console.log(`Testing SDK with model: "${v}"...`);
      const model = genAI.getGenerativeModel({ model: v });
      const res = await model.generateContent("say hello");
      console.log(`✅ SDK Success ("${v}"): "${res.response.text().trim()}"`);
    } catch (e) {
      console.log(`❌ SDK Failed ("${v}"): ${e.message}`);
    }
  }
}

testUnification();
