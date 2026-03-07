/**
 * 🗄️ SENTINEL DATABASE RESTORE UTILITY
 * Restores the local database from a timestamped backup file.
 * Usage: node scripts/restore-db.js [backup-filename]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const DB_PATH = path.join(__dirname, '..', 'server', 'sentinel.db');

async function restore() {
  const backupFile = process.argv[2];

  if (!backupFile) {
    console.log('❌ Error: No backup file specified.');
    console.log('Usage: node scripts/restore-db.js sentinel-backup-YYYY-MM-DD.db');
    
    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
      if (files.length > 0) {
        console.log('\nAvailable backups:');
        files.sort().reverse().slice(0, 5).forEach(f => console.log(` - ${f}`));
      }
    }
    process.exit(1);
  }

  const backupPath = path.join(BACKUP_DIR, backupFile);

  if (!fs.existsSync(backupPath)) {
    console.error(`💥 Error: Backup file not found at ${backupPath}`);
    process.exit(1);
  }

  try {
    console.log(`📡 [Restore] Restoring database from: ${backupFile}`);
    
    // 1. Safety Check: If sentinel.db exists, back it up first as 'sentinel.db.pre-restore'
    if (fs.existsSync(DB_PATH)) {
      console.log('🛡️  Safety: Creating temporary pre-restore backup...');
      fs.copyFileSync(DB_PATH, `${DB_PATH}.pre-restore`);
    }

    // 2. Perform restore
    fs.copyFileSync(backupPath, DB_PATH);
    
    console.log('🎉 Restore Mission Complete.');
    console.log('💡 Note: Restart the backend to apply changes.');
    process.exit(0);
  } catch (err) {
    console.error('💥 Restore Failed:', err.message);
    process.exit(1);
  }
}

restore();
