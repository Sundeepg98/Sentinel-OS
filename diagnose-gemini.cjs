const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

async function diagnoseGemini() {
  console.log("=== Sentinel-OS Gemini Diagnostic Tool ===");
  const key = process.env.GEMINI_API_KEY || "AIzaSyD-RPb_Ym57U_tQpO1GkEMpm1QACOrI_4s";
  console.log(`API Key present: ${key ? "YES" : "NO"}`);
  
  if (!key) return;

  // Test 1: Direct API Fetch (The source of truth)
  try {
    console.log("\n1. Fetching available models for your key...");
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error("API Error:", data.error.message);
    } else if (data.models) {
      console.log("SUCCESS! Your key has access to these model names:");
      data.models.forEach(m => console.log(` - ${m.name}`));
    } else {
      console.log("Unexpected API response format:", data);
    }
  } catch (e) {
    console.error("Network fetch failed:", e.message);
  }

  // Test 2: Try to initialize specific model
  try {
    console.log("\n2. Testing SDK initialization with gemini-2.5-flash...");
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("test");
    console.log("SUCCESS! SDK call completed.");
  } catch (e) {
    console.error("SDK call failed:", e.message);
  }
}

diagnoseGemini();
