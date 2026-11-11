// Runs before the server on every deploy (npm start):
//  1. prisma db push: the database follows prisma/schema.prisma (new columns, tables).
//     It refuses changes that would lose data; then the deploy fails and the previous
//     version keeps running, nothing is broken.
//  2. Then the server starts and imports the catalog in the background (scripts/catalog-sync.js).
require('dotenv').config();
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function run(cmd) {
  console.log(`[deploy-sync] ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: process.env });
}

(async () => {
  if (process.env.SKIP_DEPLOY_SYNC === 'true') return console.log('[deploy-sync] skipped (SKIP_DEPLOY_SYNC)');

  // 1. Schema: a failure stops the deploy (the new code needs these columns)
  run('npx prisma db push --skip-generate');

  // 2. The catalog is imported by the server once it listens (scripts/catalog-sync.js),
  //    so a long import never makes the deploy's health check time out.
})().catch(e => {
  console.error('[deploy-sync] failed:', e.message);
  process.exit(1);
});
