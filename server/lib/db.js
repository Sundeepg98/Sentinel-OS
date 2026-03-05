/**
 * 🛰️ SENTINEL DATABASE SWITCHER
 * Automatically toggles between Local SQLite and Cloud Postgres
 * based on the presence of a DATABASE_URL environment variable.
 */

if (process.env.DATABASE_URL) {
  // CLOUD MODE (Postgres)
  module.exports = require('./db-postgres');
} else {
  // LOCAL MODE (SQLite)
  module.exports = require('./db-sqlite');
}
