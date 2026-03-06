const { Pool } = require('pg');
const pgvector = require('pgvector/pg');
const fs = require('fs');
const path = require('path');

/**
 * 🐘 POSTGRESQL ENGINE (Cloud-Native Persistence)
 * Optimized for managed environments like Render/Neon with pgvector.
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // 🛡️ ENGINEERING BASIC: Strict Connection Pooling
  max: 20, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const db = {
  async query(text, params) {
    return pool.query(text, params);
  },
  async exec(sql) {
    // 🛡️ SECURITY: Postgres doesn't support multiple statements in one query easily
    // We split by semicolon for base setup
    const statements = sql.split(';').filter(s => s.trim());
    for (const s of statements) {
      await pool.query(s);
    }
  },
  prepare(sql) {
    return {
      get: async (...params) => {
        const pgSql = sql.replace(/\?/g, (_, i) => `$${i + 1}`);
        const res = await pool.query(pgSql, params);
        return res.rows[0];
      },
      all: async (...params) => {
        const pgSql = sql.replace(/\?/g, (_, i) => `$${i + 1}`);
        const res = await pool.query(pgSql, params);
        return res.rows;
      },
      run: async (...params) => {
        const pgSql = sql.replace(/\?/g, (_, i) => `$${i + 1}`);
        return pool.query(pgSql, params);
      }
    };
  },
  close: async () => {
    console.log("🗄️ Draining PostgreSQL connection pool...");
    await pool.end();
  }
};

async function initDB() {
  console.log("🛠️ Initializing Cloud Database Engine (Postgres)...");
  
  try {
    // 1. Install pgvector extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    // 2. Initial Setup
    await db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dossiers (
        id TEXT PRIMARY KEY,
        company TEXT,
        label TEXT,
        content TEXT,
        metadata JSONB,
        last_processed TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chunks_metadata (
        id SERIAL PRIMARY KEY,
        file_id TEXT,
        chunk_text TEXT,
        metadata JSONB,
        embedding vector(3072)
      );

      CREATE TABLE IF NOT EXISTS user_state (
        user_id TEXT,
        key TEXT,
        value JSONB,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, key)
      );

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

    // 3. Process Versioned Migrations
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        const check = await db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(file);
        if (!check) {
          console.log(`🚀 Applying Cloud Migration: ${file}`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          // Basic translation from SQLite to Postgres syntax
          const pgSql = sql
            .replace(/DATETIME/g, 'TIMESTAMPTZ')
            .replace(/integer PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
          
          await db.exec(pgSql);
          await db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(file);
        }
      }
    }

    console.log("✅ Cloud Database Synced & Stable.");
  } catch (err) {
    console.error("❌ Cloud Initialization Error:", err.message);
    throw err;
  }
}

module.exports = { db, initDB, isPostgres: true };
