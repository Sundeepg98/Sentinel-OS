-- Migration 005: Persistent System Logs
-- Migrates telemetry from local files to persistent database storage.

CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT, -- 'AI' or 'UI'
  category TEXT,
  message TEXT,
  payload TEXT,
  stack TEXT,
  url TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
