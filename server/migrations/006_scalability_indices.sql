-- Migration 006: Scalability Indices
-- Adds physical indices to optimize query performance at Staff scale.

-- Optimize dossier lookups and pruning
CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks_metadata(file_id);

-- Optimize telemetry audit lookups
CREATE INDEX IF NOT EXISTS idx_logs_type_timestamp ON system_logs(type, timestamp);

-- Optimize interaction history lookups
CREATE INDEX IF NOT EXISTS idx_history_user_timestamp ON interaction_history(user_id, timestamp);
