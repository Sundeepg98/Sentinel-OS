-- Migration 002: Knowledge Stacking
CREATE TABLE IF NOT EXISTS interaction_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT DEFAULT 'local-admin',
  type TEXT, -- 'drill' or 'incident'
  module_id TEXT,
  question TEXT,
  user_answer TEXT,
  evaluation TEXT,
  score INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
