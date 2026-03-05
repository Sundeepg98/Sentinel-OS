const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');
const path = require('path');
const fs = require('fs');

// --- 🛠️ ENGINEERING BASIC: DB SEGREGATION ---
const isTest = process.env.NODE_ENV === 'test';
const dbFile = isTest ? ':memory:' : path.join(__dirname, '..', 'sentinel.db');

const db = new Database(dbFile);
sqliteVec.load(db);

function initDB() {
  console.log("🛠️ Initializing Database Engine...");
  
  // 1. Ensure migration tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Identify and run pending migrations
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const isApplied = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(file);
    
    if (!isApplied) {
      console.log(`🚀 Applying Migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        db.transaction(() => {
          db.exec(sql);
          db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(file);
        })();
      } catch (e) {
        // Special case: Vector dimension mismatch recovery during migration
        if (e.message.includes('dimension mismatch') || e.message.includes('vec0')) {
          console.warn("⚠️ Vector dimension mismatch in migration. Re-aligning...");
          db.exec(`DROP TABLE IF EXISTS vec_chunks;`);
          db.exec(sql); // Retry the SQL after drop
          db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(file);
        } else {
          console.error(`❌ Migration Failed [${file}]:`, e.message);
          throw e; // Stop startup on critical failure
        }
      }
    }
  }
  
  console.log("✅ Database Engine Synced & Stable.");
}

module.exports = { db, initDB };
