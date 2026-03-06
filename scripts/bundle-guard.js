/**
 * 🛡️ SENTINEL BUNDLE GUARD
 * Monitors the production build size to prevent performance regressions.
 * Usage: node scripts/bundle-guard.js
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(process.cwd(), 'dist');
const MAX_BUNDLE_SIZE_MB = 2.5; // 2.5MB Limit

function getDirSize(dir) {
  const files = fs.readdirSync(dir);
  let total = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      total += getDirSize(filePath);
    } else {
      total += stats.size;
    }
  });

  return total;
}

function check() {
  console.log('🔍 Executing Bundle Size Audit...');
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ Error: dist/ folder not found. Run npm run build first.');
    process.exit(1);
  }

  const totalSize = getDirSize(DIST_DIR);
  const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

  console.log(`📊 Total Build Size: ${sizeMB}MB`);
  console.log(`⚖️ Target Threshold: ${MAX_BUNDLE_SIZE_MB}MB`);

  if (parseFloat(sizeMB) > MAX_BUNDLE_SIZE_MB) {
    console.error(`🚨 CRITICAL: Production bundle exceeds safety limit! (+${(sizeMB - MAX_BUNDLE_SIZE_MB).toFixed(2)}MB)`);
    process.exit(1);
  }

  console.log('✅ Performance Gate Passed.');
}

check();
