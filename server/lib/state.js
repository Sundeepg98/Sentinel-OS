const { Index } = require('flexsearch');

/**
 * 🛰️ GLOBAL SENTINEL STATE
 * Centralized state management for the RAG index and real-time clients.
 */
const globalState = {
  knowledgeGraph: { concepts: {}, files: {} },
  searchIndex: new Index({ preset: 'score', tokenize: 'forward' }),
  clients: [],
  isSyncing: false,
  activeWorker: null
};

module.exports = { globalState };
