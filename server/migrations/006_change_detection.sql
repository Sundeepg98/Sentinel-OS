-- Migration 006: Change Detection Optimization
-- Adds content_hash to dossiers for industrial-grade hot-reloading support.

ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS content_hash TEXT;
