const { parentPort, workerData } = require('worker_threads');
const { syncIntelligence, getKnowledgeGraph, getSearchIndex } = require('./harvester');

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
    
    console.log(`✅ [RAG Worker] Sync Complete in ${duration}s. Sending data to main loop...`);
    
    // Transfer the built state back to main thread
    parentPort.postMessage({ 
      status: 'complete', 
      duration,
      knowledgeGraph: getKnowledgeGraph(),
      searchIndexExport: getSearchIndex().export() // FlexSearch needs to be exported/imported as string
    });
  } catch (error) {
    console.error('❌ [RAG Worker] Sync Error:', error.message);
    parentPort.postMessage({ status: 'error', message: error.message });
  }
}

runSync();
