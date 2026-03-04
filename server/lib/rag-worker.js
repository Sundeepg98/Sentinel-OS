const { parentPort, workerData } = require('worker_threads');
const { syncIntelligence } = require('./harvester');

/**
 * RAG Worker Thread
 * Offloads heavy Markdown parsing and Embedding calculations from the main API loop.
 */
async function runSync() {
  try {
    console.log('🧵 [RAG Worker] Intelligence Sync Started...');
    const startTime = Date.now();
    await syncIntelligence();
    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ [RAG Worker] Sync Complete in ${duration}s`);
    parentPort.postMessage({ status: 'complete', duration });
  } catch (error) {
    console.error('❌ [RAG Worker] Sync Error:', error.message);
    parentPort.postMessage({ status: 'error', message: error.message });
  }
}

runSync();
