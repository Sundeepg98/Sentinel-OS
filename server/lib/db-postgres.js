const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

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
    logger.info("🗄️ Draining PostgreSQL connection pool...");
    await pool.end();
  }
};

async function initDB() {
  logger.info("🛠️ Initializing Cloud Database Engine (Postgres)");
  
  try {
    // 1. Install pgvector extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    // 2. Initial Setup (Meta Table Only)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Process Versioned Migrations
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        const check = await db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(file);
        if (!check) {
          logger.info({ migration: file }, "🚀 Applying Cloud Migration");
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          // Advanced translation from SQLite to Postgres syntax
          const pgSql = sql
            .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP')
            .replace(/integer PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
            .replace(/metadata TEXT/gi, 'metadata JSONB')
            .replace(/evaluation TEXT/gi, 'evaluation JSONB')
            .replace(/value TEXT NOT NULL/gi, 'value JSONB NOT NULL')
            .replace(/vector\(3072\)/gi, 'vector(3072)') 
            .replace(/CASCADE/gi, 'CASCADE');
          
          await db.exec(pgSql);
          await db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(file);
        }
      }
    }

    logger.info("✅ Cloud Database Synced & Stable.");
  } catch (err) {
    logger.error({ error: err.message }, "❌ Cloud Initialization Error");
    throw err;
  }
}

module.exports = { db, initDB, pool, isPostgres: true };
