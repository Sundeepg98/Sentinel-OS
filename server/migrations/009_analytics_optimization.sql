-- Migration 009: Database Optimization for Analytics and State
-- Enhances query speed for historical interaction tracking and user scores.

CREATE INDEX IF NOT EXISTS idx_history_type ON interaction_history(type);
CREATE INDEX IF NOT EXISTS idx_user_state_user_key ON user_state(user_id, key);
