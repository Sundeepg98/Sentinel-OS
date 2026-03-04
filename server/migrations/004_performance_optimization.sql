-- Migration 004: Performance Optimization
CREATE INDEX IF NOT EXISTS idx_user_history ON interaction_history(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_user_state ON user_state(user_id, key);
