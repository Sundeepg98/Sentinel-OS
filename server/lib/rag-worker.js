const { parentPort } = require('worker_threads');
const chokidar = require('chokidar');
const path = require('path');
const { syncIntelligence, getKnowledgeGraph, INTELLIGENCE_DIR } = require('./harvester');

/**
 * RAG Worker Thread - Real-time Sync Edition
 * Offloads heavy Markdown parsing and Embedding calculations.
 * Now monitors the filesystem for changes to provide Hot-Reloading.
 */
async function runInitialSync() {
  try {
    console.log('🧵 [RAG Worker] Initial Intelligence Sync Started...');
    const startTime = Date.now();
    await syncIntelligence();
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`✅ [RAG Worker] Initial Sync Complete in ${duration}s.`);
    
    // Transfer the built state back to main thread
    parentPort.postMessage({ 
      status: 'complete', 
      duration,
      knowledgeGraph: getKnowledgeGraph()
    });

    // --- REAL-TIME WATCHER ---
    console.log(`👁️ [RAG Worker] Watching for dossier changes in: ${INTELLIGENCE_DIR}`);
    
    const watcher = chokidar.watch(INTELLIGENCE_DIR, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true // we already did the initial sync
    });

    const triggerUpdate = async (filePath) => {
      if (!filePath.endsWith('.md')) return;
      console.log(`🔄 [RAG Worker] Change detected: ${path.basename(filePath)}. Re-syncing...`);
      const updateStart = Date.now();
      await syncIntelligence();
      const updateDuration = (Date.now() - updateStart) / 1000;
      
      parentPort.postMessage({ 
        status: 'complete', 
        duration: updateDuration,
        knowledgeGraph: getKnowledgeGraph(),
        isHotReload: true
      });
    };

    watcher
      .on('add', triggerUpdate)
      .on('change', triggerUpdate)
      .on('unlink', triggerUpdate);

  } catch (error) {
    console.error('❌ [RAG Worker] Sync Error:', error);
    parentPort.postMessage({ status: 'error', message: error.message, stack: error.stack });
  }
}

runInitialSync();
