const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const config = require('./config');

/**
 * 🗄️ SQLITE ENGINE (Local Development)
 */

const isTest = process.env.NODE_ENV === 'test';
const dbFile = isTest ? ':memory:' : path.join(__dirname, '..', 'sentinel.db');

const db = new Database(dbFile);
db.pragma(`journal_mode = WAL`); // 🚀 PERFORMANCE BASIC: Non-blocking writes
db.pragma(`synchronous = ${config.DB.SQLITE.SYNC_MODE}`); // 🚀 PERFORMANCE: Reduced disk sync frequency
db.pragma(`cache_size = ${config.DB.SQLITE.CACHE_SIZE}`); // 🚀 PERFORMANCE: Configurable Cache
db.pragma('foreign_keys = ON'); // 🛡️ INTEGRITY BASIC
sqliteVec.load(db);

async function initDB() {
  logger.info({ db: dbFile }, '🛠️ Initializing Local Database Engine (SQLite)');

  // Initialize Vector Extension Table
  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(id INTEGER PRIMARY KEY, vector FLOAT[3072])`
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Local migrations only for SQLite
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const isApplied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(file);
      if (!isApplied) {
        // Skip Postgres-only or incompatible migrations
        const skippedMigrations = ['006_change_detection.sql', '007_vector_index.sql'];
        if (skippedMigrations.includes(file)) {
          db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
          continue;
        }

        logger.info({ migration: file }, '🚀 Applying SQLite Migration');

        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
          db.transaction(() => {
            db.exec(sql);
            db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
          })();
        } catch (e) {
          logger.error({ migration: file, error: e.message }, '❌ Migration Failed');
        }
      }
    }
  }

  logger.info('✅ Local Database Synced & Stable.');
}

module.exports = { db, initDB, isPostgres: false };
