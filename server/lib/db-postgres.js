const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('./config');

/**
 * 🐘 POSTGRESQL ENGINE (Cloud-Native Persistence)
 * Optimized for managed environments like Render/Neon with pgvector.
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  // 🛡️ ENGINEERING BASIC: Strict Connection Pooling
  max: config.DB.POSTGRES.POOL_MAX,
  idleTimeoutMillis: config.DB.POSTGRES.IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: config.DB.POSTGRES.CONN_TIMEOUT_MS,
});

// 🛡️ STAFF BASIC: Global pool error handler
pool.on('error', (err) => {
  logger.error(err, '🚨 Unexpected error on idle PostgreSQL client');
});

const db = {
  async query(text, params) {
    return pool.query(text, params);
  },
  async exec(sql) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const statements = sql.split(';').filter((s) => s.trim());
      for (const s of statements) {
        await client.query(s);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
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
      },
    };
  },
  close: async () => {
    logger.info('🗄️ Draining PostgreSQL connection pool...');
    await pool.end();
  },
};

async function initDB() {
  logger.info('🛠️ Initializing Cloud Database Engine (Postgres)');

  let attempt = 1;
  const maxAttempts = config.DB.RETRY.MAX_ATTEMPTS;
  let delay = config.DB.RETRY.INITIAL_DELAY_MS;

  while (attempt <= maxAttempts) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (err) {
      if (attempt === maxAttempts) {
        logger.error(
          { error: err.message },
          '❌ Cloud Database Connection Failed after max attempts'
        );
        throw err;
      }
      logger.warn(
        { attempt, error: err.message, nextRetryIn: `${delay}ms` },
        '⚠️ Cloud Database connection failed. Retrying...'
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
      delay *= 2;
    }
  }

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
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const file of files) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // 🛡️ STAFF BASIC: Use same client for transactional check and execution
          const checkRes = await client.query(
            'SELECT 1 FROM schema_migrations WHERE version = $1',
            [file]
          );
          if (checkRes.rowCount === 0) {
            logger.info({ migration: file }, '🚀 Applying Cloud Migration');
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            const pgSql = sql
              .replace(
                /DATETIME DEFAULT CURRENT_TIMESTAMP/gi,
                'TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP'
              )
              .replace(/integer PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
              .replace(/metadata TEXT/gi, 'metadata JSONB')
              .replace(/evaluation TEXT/gi, 'evaluation JSONB')
              .replace(/value TEXT NOT NULL/gi, 'value JSONB NOT NULL')
              .replace(/vector\(3072\)/gi, 'vector(3072)')
              .replace(/CASCADE/gi, 'CASCADE');

            const statements = pgSql.split(';').filter((s) => s.trim());
            for (const s of statements) {
              await client.query(s);
            }
            await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          }
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
    }

    logger.info('✅ Cloud Database Synced & Stable.');
  } catch (err) {
    logger.error({ error: err.message }, '❌ Cloud Initialization Error');
    throw err;
  }
}

module.exports = { db, initDB, pool, isPostgres: true };
