/**
 * 🛰️ SENTINEL ENVIRONMENT VERIFIER
 * This script pings all three tiers of the architecture to ensure 
 * they are stable, correctly configured, and running the latest code.
 * 
 * Usage: node scripts/verify-environments.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const environments = [
  { name: 'Local', url: process.env.LOCAL_API_URL || 'http://localhost:3002' },
  { name: 'Staging', url: process.env.STAGING_API_URL || 'https://sentinel-os-staging.onrender.com' },
  { name: 'Production', url: process.env.PRODUCTION_API_URL || 'https://sentinel-os-bcsv.onrender.com' }
];

async function verify() {
  console.log('🔍 Gathering Sentinel-OS Intelligence Matrix...\n');
  console.log('-------------------------------------------------------------------------------------------------------');
  console.log('| ENV        | STATUS  | DB TYPE  | VERSION  | LATENCY | MEM (RSS) | UPTIME   | AUTH     |');
  console.log('-------------------------------------------------------------------------------------------------------');

  for (const env of environments) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${env.url}/health`, { 
        signal: controller.signal,
        headers: { 'x-sentinel-bypass': process.env.VITE_DEV_BYPASS_TOKEN || 'sentinel_staff_2026' }
      });
      clearTimeout(timeout);
      
      const latency = Date.now() - start;
      
      if (response.ok) {
        const result = await response.json();
        const data = result.data || {};
        const resources = data.resources || {};
        
        console.log(
          `| ${env.name.padEnd(10)} | ✅ LIVE  | ${(data.db || '???').padEnd(8)} | ${(data.version || '???').padEnd(8)} | ${String(latency).padStart(5)}ms | ${(resources.memory?.rss || 'N/A').padEnd(9)} | ${(resources.uptime || 'N/A').padEnd(8)} | ${(data.auth || 'ENABLED').padEnd(8)} |`
        );
      } else {
        console.log(`| ${env.name.padEnd(10)} | ❌ ERROR | ${'N/A'.padEnd(8)} | ${'N/A'.padEnd(8)} | ${String(latency).padStart(5)}ms | ${'N/A'.padEnd(9)} | ${'N/A'.padEnd(8)} | ${'N/A'.padEnd(8)} |`);
      }
    } catch (err) {
      console.log(`| ${env.name.padEnd(10)} | 💤 SLEEP | ${'N/A'.padEnd(8)} | ${'N/A'.padEnd(8)} | ${'>10s'.padStart(7)} | ${'N/A'.padEnd(9)} | ${'N/A'.padEnd(8)} | ${'N/A'.padEnd(8)} |`);
    }
  }
  console.log('-------------------------------------------------------------------------------------------------------\n');
}

verify();
