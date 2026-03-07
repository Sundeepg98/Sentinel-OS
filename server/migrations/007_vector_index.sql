-- Migration 007: Vector Search Optimization (pgvector)
-- Implements HNSW (Hierarchical Navigable Small World) index for O(1) semantic retrieval.
-- This index is specific to Postgres and will be ignored by SQLite.

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
    ON chunks_metadata USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  END IF;
END $$;
