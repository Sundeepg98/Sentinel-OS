-- Migration 001: Base Schema
CREATE TABLE IF NOT EXISTS user_state (
  user_id TEXT DEFAULT 'local-admin',
  key TEXT,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, key)
);

CREATE TABLE IF NOT EXISTS intelligence_cache (
  file_id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  label TEXT,
  company TEXT,
  keywords TEXT,
  last_processed DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chunks_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT,
  chunk_text TEXT,
  metadata TEXT,
  FOREIGN KEY(file_id) REFERENCES intelligence_cache(file_id) ON DELETE CASCADE
);
