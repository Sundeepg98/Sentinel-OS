const { Pool } = require('pg');
const pgvector = require('pgvector/pg');
const fs = require('fs');
const path = require('path');

/**
 * 🐘 POSTGRESQL ENGINE (Cloud-Native Persistence)
 * Optimized for managed environments like Render.
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // 🛡️ ENGINEERING BASIC: Strict Connection Pooling
  max: 20, // Max number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

const db = {
  async query(text, params) {
    return pool.query(text, params);
  },
  async exec(sql) {
    return pool.query(sql);
  },
  // Mocking better-sqlite3 structure for minimal friction
  prepare(sql) {
    return {
      get: async (...params) => {
        // Handle SQLite (?) to Postgres ($1) parameter conversion if needed
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
    // 1. Install pgvector
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    // 2. Migration Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Versioned Migrations (Parity with SQLite)
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const checkRes = await pool.query("SELECT 1 FROM schema_migrations WHERE version = $1", [file]);
        if (checkRes.rowCount === 0) {
          console.log(`🚀 Applying Cloud Migration: ${file}`);
          let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          
          // Basic translation for SQLite types to Postgres
          sql = sql.replace(/DATETIME/g, 'TIMESTAMPTZ')
                   .replace(/AUTOINCREMENT/g, 'SERIAL')
                   .replace(/INTEGER PRIMARY KEY/g, 'SERIAL PRIMARY KEY');

          try {
            await pool.query(sql);
            await pool.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
          } catch (e) {
            console.error(`❌ Cloud Migration Failed [${file}]:`, e.message);
          }
        }
      }
    }

    // 4. Ensure RAG-specific tables exist (if not in migrations yet)
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

    console.log("✅ Cloud Database Synced & Stable.");
  } catch (err) {
    console.error("❌ Cloud Initialization Error:", err.message);
    throw err;
  }
}

module.exports = { db, initDB, isPostgres: true };
