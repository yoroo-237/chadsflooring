// The chadsflooring.bz catalog (prisma/data/chadsflooring-catalog.json) is imported once per
// version of that file, by the server right after it starts. The file's hash is kept in
// SiteSetting: a restart never imports it again (that would reset stocks to the file's values),
// a new file is imported once. A failed import is logged and retried at the next start.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const prisma = require('../src/db');

const ROOT = path.join(__dirname, '..');
const CATALOG = path.join(ROOT, 'prisma', 'data', 'chadsflooring-catalog.json');
const KEY = 'catalog_import_hash';

async function syncCatalog() {
  if (process.env.SKIP_CATALOG_IMPORT === 'true' || !fs.existsSync(CATALOG)) return;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(CATALOG)).digest('hex');
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  if (row?.value === hash) return console.log('[catalog-sync] catalog already imported');
  console.log('[catalog-sync] importing the catalog…');
  await new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(__dirname, 'import-chadsflooring.js')], { cwd: ROOT, env: process.env, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (stdout) console.log(stdout.trim());
        if (err) return reject(new Error(stderr?.trim() || err.message));
        resolve();
      });
  });
  await prisma.siteSetting.upsert({ where: { key: KEY }, update: { value: hash }, create: { key: KEY, value: hash } });
  console.log('[catalog-sync] catalog imported');
}

module.exports = {
  startCatalogSync: () => syncCatalog().catch(e => console.error('[catalog-sync] import failed, retried at the next start:', e.message)),
};
