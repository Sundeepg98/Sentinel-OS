/**
 * 🛰️ SENTINEL DATABASE SWITCHER
 * Automatically toggles between Local SQLite and Cloud Postgres
 * based on the presence of a DATABASE_URL environment variable.
 */

if (process.env.DATABASE_URL) {
  // CLOUD MODE (Postgres)
  const { db, initDB, pool, isPostgres } = require('./db-postgres');
  module.exports = { db, initDB, pool, isPostgres };
} else {
  // LOCAL MODE (SQLite)
  const { db, initDB, isPostgres } = require('./db-sqlite');
  module.exports = { db, initDB, pool: null, isPostgres };
}
