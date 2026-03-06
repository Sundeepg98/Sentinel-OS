const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

/**
 * 🗄️ SQLITE ENGINE (Local Development)
 */

const isTest = process.env.NODE_ENV === 'test';
const dbFile = isTest ? ':memory:' : path.join(__dirname, '..', 'sentinel.db');

const db = new Database(dbFile);
sqliteVec.load(db);

async function initDB() {
  logger.info({ db: dbFile }, '🛠️ Initializing Local Database Engine (SQLite)');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Local migrations only for SQLite
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const isApplied = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(file);
      if (!isApplied) {
        logger.info({ migration: file }, '🚀 Applying SQLite Migration');
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
          db.exec(sql);
          db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(file);
        } catch (e) {
          logger.error({ migration: file, error: e.message }, '❌ Migration Failed');
        }
      }
    }
  }
  
  logger.info('✅ Local Database Synced & Stable.');
}

module.exports = { db, initDB, isPostgres: false };
