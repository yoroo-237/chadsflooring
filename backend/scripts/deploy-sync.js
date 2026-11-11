// Runs before the server on every deploy (npm start):
//  1. prisma/sql/*.sql: the exact schema changes, written to be run again and again
//     (IF NOT EXISTS). A failure here stops the deploy: the new code needs these columns,
//     and the previous version keeps running.
//  2. prisma db push: brings anything else in line with prisma/schema.prisma. It refuses
//     changes that could lose data (it can't ask, nobody answers on a deploy): then it is
//     only logged, the server still starts, and the change is applied by hand.
//  3. Then the server starts and imports the catalog in the background (scripts/catalog-sync.js).
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PRISMA = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
const SQL_DIR = path.join(ROOT, 'prisma', 'sql');

function prisma(args) {
  console.log(`[deploy-sync] prisma ${args.join(' ')}`);
  execFileSync(process.execPath, [PRISMA, ...args], { cwd: ROOT, stdio: 'inherit', env: process.env, timeout: 120000 });
}

if (process.env.SKIP_DEPLOY_SYNC === 'true') {
  console.log('[deploy-sync] skipped (SKIP_DEPLOY_SYNC)');
  process.exit(0);
}

try {
  for (const file of fs.readdirSync(SQL_DIR).filter(f => f.endsWith('.sql')).sort()) {
    prisma(['db', 'execute', '--file', path.join(SQL_DIR, file), '--schema', 'prisma/schema.prisma']);
  }
} catch (e) {
  console.error('[deploy-sync] schema SQL failed:', e.message);
  process.exit(1);
}

try {
  prisma(['db', 'push', '--skip-generate']);
} catch (e) {
  console.error('[deploy-sync] prisma db push did not apply (see above); the server starts anyway:', e.message);
}
