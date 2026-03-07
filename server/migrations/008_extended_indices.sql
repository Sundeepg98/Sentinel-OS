-- Migration 008: Extended Performance Indices
-- Optimizes filtered company views and per-module interaction telemetry.

CREATE INDEX IF NOT EXISTS idx_dossiers_company ON dossiers(company);
CREATE INDEX IF NOT EXISTS idx_history_module_id ON interaction_history(module_id);
