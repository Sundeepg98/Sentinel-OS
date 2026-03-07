const { parentPort } = require('worker_threads');
const chokidar = require('chokidar');
const path = require('path');
const { syncIntelligence, getKnowledgeGraph, INTELLIGENCE_DIR } = require('./harvester');
const logger = require('./logger');

logger.info('--- ðŸ¤– RAG WORKER STARTING ---');

/**
 * RAG WORKER THREAD
 * Offloads heavy Markdown parsing and Embedding calculations.
 * Now monitors the filesystem for changes to provide Hot-Reloading.
 */

async function runInitialSync() {
  try {
    const start = Date.now();
    logger.info('ðŸ§µ [RAG Worker] Initial Intelligence Sync Started...');

    await syncIntelligence();
    const duration = (Date.now() - start) / 1000;

    logger.info({ duration: `${duration}s` }, 'âœ… [RAG Worker] Initial Sync Complete');

    // 🛡️ STAFF BASIC: Worker Heartbeat
    setInterval(() => {
      parentPort.postMessage({ status: 'heartbeat', timestamp: Date.now() });
    }, 10000);

    // Send initial hydration to main process
    parentPort.postMessage({
      status: 'complete',
      knowledgeGraph: getKnowledgeGraph(),
      duration,
    });

    // ðŸ‘ï¸ START FILE WATCHER
    logger.info({ dir: INTELLIGENCE_DIR }, 'ðŸ‘ï¸ [RAG Worker] Watching for dossier changes');

    const watcher = chokidar.watch(INTELLIGENCE_DIR, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true, // ðŸš€ ENGINEERING BASIC: Prevent re-index storm on startup
    });

    const triggerUpdate = async (filePath) => {
      if (!filePath.endsWith('.md')) return;

      parentPort.postMessage({ status: 'syncing' }); // ðŸš€ Notify UI start
      logger.info(
        { file: path.basename(filePath) },
        'ðŸ”„ [RAG Worker] Change detected. Re-syncing...'
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
      .on('error', (err) =>
        logger.error({ error: err.message }, 'ðŸ‘ï¸ [RAG Worker] Watcher Error')
      );
  } catch (error) {
    logger.error({ error: error.message }, 'âŒ [RAG Worker] Sync Error');
    parentPort.postMessage({ status: 'error', message: error.message, stack: error.stack });
  }
}

runInitialSync();
