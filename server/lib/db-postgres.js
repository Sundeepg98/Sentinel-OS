const { Pool } = require('pg');
const pgvector = require('pgvector/pg');

/**
 * 🐘 POSTGRESQL ENGINE (Cloud-Native Persistence)
 * This handles the transition from ephemeral SQLite to persistent cloud storage.
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render Postgres
  }
});

// Mocking some better-sqlite3 behavior for minimal friction during migration
const db = {
  async query(text, params) {
    return pool.query(text, params);
  },
  async exec(sql) {
    return pool.query(sql);
  },
  prepare(sql) {
    return {
      get: async (...params) => {
        const res = await pool.query(sql, params);
        return res.rows[0];
      },
      all: async (...params) => {
        const res = await pool.query(sql, params);
        return res.rows;
      },
      run: async (...params) => {
        // Postgres uses $1, $2, SQLite uses ?
        // We'll handle this in the specific callers
        return pool.query(sql, params);
      }
    };
  }
};

async function initDB() {
  console.log("🛠️ Initializing Cloud Database Engine (Postgres)...");
  
  try {
    // 1. Install pgvector extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    // 2. Core Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dossiers (
        id TEXT PRIMARY KEY,
        company TEXT,
        label TEXT,
        content TEXT,
        metadata JSONB,
        last_processed TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chunks_metadata (
        id SERIAL PRIMARY KEY,
        file_id TEXT,
        chunk_text TEXT,
        metadata JSONB,
        embedding vector(3072)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_state (
        user_id TEXT,
        key TEXT,
        value JSONB,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, key)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS interaction_history (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        type TEXT,
        module_id TEXT,
        question TEXT,
        user_answer TEXT,
        evaluation JSONB,
        score INTEGER,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Cloud Database Synced & Stable.");
  } catch (err) {
    console.error("❌ Cloud Migration Error:", err.message);
    throw err;
  }
}

module.exports = { db, initDB, isPostgres: true };
