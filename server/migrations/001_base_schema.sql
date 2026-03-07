-- Migration 001: Consolidated Base Schema (Staff Edition)
-- Unified schema for all environment tiers.

CREATE TABLE IF NOT EXISTS dossiers (
  id TEXT PRIMARY KEY,
  company TEXT,
  label TEXT,
  content TEXT,
  metadata TEXT, -- JSON in Postgres, TEXT in SQLite
  content_hash TEXT, -- 🚀 PERFORMANCE: Change detection
  last_processed DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chunks_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT,
  chunk_text TEXT,
  metadata TEXT,
  embedding vector(3072), -- Managed by pgvector in Cloud
  FOREIGN KEY(file_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

-- --- 🛡️ SQLITE VECTOR EXTENSION ---
-- This is a virtual table for local semantic search. 
-- In Postgres, it's ignored as embeddings are in chunks_metadata.
-- We use a conditional exec in the engine loader for this.

CREATE TABLE IF NOT EXISTS user_state (
  user_id TEXT,
  key TEXT,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS interaction_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  type TEXT,
  module_id TEXT,
  question TEXT,
  user_answer TEXT,
  evaluation TEXT,
  score INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT, -- 📡 Traceability
  type TEXT,
  category TEXT,
  message TEXT,
  payload TEXT,
  metadata TEXT, -- 📊 Extended telemetry (JSON)
  stack TEXT,
  url TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- --- 🚀 PERFORMANCE INDICES ---
CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks_metadata(file_id);
CREATE INDEX IF NOT EXISTS idx_logs_type_timestamp ON system_logs(type, timestamp);
CREATE INDEX IF NOT EXISTS idx_history_user_timestamp ON interaction_history(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_user_state_key ON user_state(key);
