const { Worker, SHARE_ENV } = require('worker_threads');
const path = require('path');
const { Index } = require('flexsearch');
const logger = require('./logger');
const { globalState } = require('./state');

/**
 * 🛰️ RAG ORCHESTRATION LOADER
 * Manages the lifecycle of the background intelligence worker.
 */

function spawnRAGWorker() {
  if (globalState.isSyncing) return;
  globalState.isSyncing = true;

  // 🛡️ STAFF BASIC: Share environment with worker thread
  globalState.activeWorker = new Worker(path.join(__dirname, 'rag-worker.js'), {
    env: SHARE_ENV,
  });

  globalState.activeWorker.on('message', (msg) => {
    if (msg.status === 'complete') {
      globalState.knowledgeGraph = msg.knowledgeGraph || { files: {}, concepts: {} };

      const newIndex = new Index({ preset: 'score', tokenize: 'forward' });
      Object.entries(globalState.knowledgeGraph.files).forEach(([id, file]) => {
        newIndex.add(id, file.content);
      });
      globalState.searchIndex = newIndex;
      globalState.isSyncing = false;
      globalState.lastSyncAt = new Date().toISOString();

      logger.info(
        {
          files: Object.keys(globalState.knowledgeGraph.files).length,
          concepts: Object.keys(globalState.knowledgeGraph.concepts).length,
        },
        '🔍 Search Index Synchronized.'
      );
    }
  });

  globalState.activeWorker.on('error', (err) => {
    logger.error({ error: err.message }, '🧵 RAG Worker Thread Error');
    globalState.isSyncing = false;
  });

  globalState.activeWorker.on('exit', (code) => {
    logger.warn({ code }, '🧵 RAG Worker Thread Exited');
    globalState.isSyncing = false;
    globalState.activeWorker = null;

    // 🛡️ STAFF BASIC: Auto-restart on crash (non-zero exit)
    if (code !== 0) {
      logger.info('🔄 RAG Worker crashed. Attempting restart in 5s...');
      setTimeout(spawnRAGWorker, 5000);
    }
  });
}

module.exports = { spawnRAGWorker };
