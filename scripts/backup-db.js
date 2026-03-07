/**
 * 🗄️ SENTINEL DATABASE BACKUP UTILITY
 * Performs automated, timestamped backups of the local or cloud database.
 * Usage: node scripts/backup-db.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 7;

async function backup() {
  console.log('📦 Starting Database Backup...');
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const isPostgres = !!process.env.DATABASE_URL;

  try {
    if (isPostgres) {
      console.log('🐘 Exporting Cloud Postgres to JSON...');
      // Since we don't assume pg_dump is installed, we use a simple Node export for the free tier
      const { db } = require('../server/lib/db');
      await require('../server/lib/db').initDB();
      
      const tables = ['dossiers', 'chunks_metadata', 'user_state', 'interaction_history', 'system_logs'];
      const data = {};
      
      for (const table of tables) {
        const res = await db.query(`SELECT * FROM ${table}`);
        data[table] = res.rows;
      }
      
      const backupPath = path.join(BACKUP_DIR, `sentinel-cloud-backup-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
      console.log(`✅ Cloud backup saved to: ${backupPath}`);
    } else {
      console.log('🗄️ Copying Local SQLite binary...');
      const dbPath = path.join(process.cwd(), 'server', 'sentinel.db');
      if (fs.existsSync(dbPath)) {
        const backupPath = path.join(BACKUP_DIR, `sentinel-local-backup-${timestamp}.db`);
        fs.copyFileSync(dbPath, backupPath);
        console.log(`✅ Local backup saved to: ${backupPath}`);
      } else {
        console.error('❌ SQLite database not found.');
      }
    }

    // --- GARBAGE COLLECTION ---
    const files = fs.readdirSync(BACKUP_DIR)
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS) {
      console.log(`🧹 Pruning ${files.length - MAX_BACKUPS} old backups...`);
      files.slice(MAX_BACKUPS).forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f.name));
      });
    }

    console.log('🎉 Backup Mission Complete.');
    if (db && typeof db.close === 'function') {
      await db.close();
    }
    process.exit(0);
  } catch (err) {
    console.error('💥 Backup Failed:', err.message);
    process.exit(1);
  }
}

backup();
