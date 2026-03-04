const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'sentinel.db');
const db = new Database(dbFile);
sqliteVec.load(db);

function initDB() {
  // Initialize Tables with Multi-Tenant & History Support
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_state (
      user_id TEXT DEFAULT 'local-admin',
      key TEXT,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, key)
    );
    
    CREATE TABLE IF NOT EXISTS interaction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'local-admin',
      type TEXT, -- 'drill' or 'incident'
      module_id TEXT,
      question TEXT,
      user_answer TEXT,
      evaluation TEXT,
      score INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS intelligence_cache (
      file_id TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      label TEXT,
      company TEXT,
      keywords TEXT,
      last_processed DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chunks_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT,
      chunk_text TEXT,
      metadata TEXT,
      FOREIGN KEY(file_id) REFERENCES intelligence_cache(file_id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
      id INTEGER PRIMARY KEY,
      vector FLOAT[3072]
    );
  `);

  // Self-healing check for legacy schema (missing user_id)
  try {
    db.prepare("SELECT user_id FROM user_state LIMIT 1").get();
  } catch (e) {
    console.warn("⚠️ Migrating user_state to multi-tenant schema...");
    db.transaction(() => {
      db.exec(`ALTER TABLE user_state RENAME TO user_state_old;`);
      db.exec(`
        CREATE TABLE user_state (
          user_id TEXT DEFAULT 'local-admin',
          key TEXT,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(user_id, key)
        );
      `);
      db.exec(`INSERT INTO user_state (key, value, updated_at) SELECT key, value, updated_at FROM user_state_old;`);
      db.exec(`DROP TABLE user_state_old;`);
    })();
  }
}

module.exports = { db, initDB };
