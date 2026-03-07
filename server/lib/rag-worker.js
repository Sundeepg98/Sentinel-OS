const { parentPort } = require('worker_threads');
console.log('--- RAG WORKER STARTING ---');
const chokidar = require('chokidar');
const path = require('path');
const { syncIntelligence, getKnowledgeGraph, INTELLIGENCE_DIR } = require('./harvester');
const logger = require('./logger');

/**
 * RAG WORKER THREAD
 * Offloads heavy Markdown parsing and Embedding calculations.
 * Now monitors the filesystem for changes to provide Hot-Reloading.
 */

async function runInitialSync() {
  try {
    const start = Date.now();
    logger.info('🧵 [RAG Worker] Initial Intelligence Sync Started...');

    await syncIntelligence();
    const duration = (Date.now() - start) / 1000;

    logger.info({ duration: `${duration}s` }, '✅ [RAG Worker] Initial Sync Complete');

    // Send the first hydration to the main thread
    parentPort.postMessage({
      status: 'complete',
      knowledgeGraph: getKnowledgeGraph(),
      duration,
    });

    // 👁️ START FILE WATCHER
    logger.info({ dir: INTELLIGENCE_DIR }, '👁️ [RAG Worker] Watching for dossier changes');

    const watcher = chokidar.watch(INTELLIGENCE_DIR, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true, // 🚀 ENGINEERING BASIC: Prevent re-index storm on startup
    });

    const triggerUpdate = async (filePath) => {
      if (!filePath.endsWith('.md')) return;

      parentPort.postMessage({ status: 'syncing' }); // 🚀 Notify UI start
      logger.info(
        { file: path.basename(filePath) },
        '🔄 [RAG Worker] Change detected. Re-syncing...'
      );
      const updateStart = Date.now();
      await syncIntelligence();
      const updateDuration = (Date.now() - updateStart) / 1000;

      parentPort.postMessage({
        status: 'complete',
        knowledgeGraph: getKnowledgeGraph(),
        duration: updateDuration,
        isHotReload: true,
      });
    };

    watcher
      .on('add', triggerUpdate)
      .on('change', triggerUpdate)
      .on('unlink', triggerUpdate)
      .on('error', (err) => logger.error({ error: err.message }, '👁️ [RAG Worker] Watcher Error'));
  } catch (error) {
    logger.error({ error: error.message }, '❌ [RAG Worker] Sync Error');
    parentPort.postMessage({ status: 'error', message: error.message, stack: error.stack });
  }
}

runInitialSync();
