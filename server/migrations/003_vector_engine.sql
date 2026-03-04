-- Migration 003: Vector Engine
-- Note: Virtual tables don't support IF NOT EXISTS in all versions, 
-- we handle existence check in the JS runner for safety.
CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
  id INTEGER PRIMARY KEY,
  vector FLOAT[3072]
);
