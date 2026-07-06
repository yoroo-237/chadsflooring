const { cleanupExpiredDeposits } = require('../services/wallet.service');

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function run() {
  try {
    const count = await cleanupExpiredDeposits();
    if (count > 0) {
      console.log(`[DepositCleanup] ${count} expired deposit(s) cleaned`);
    }
  } catch (e) {
    console.error('[DepositCleanup] Error during cleanup:', e.message);
  }
}

function startDepositCleanupJob() {
  console.log('[DepositCleanup] Job started — runs every hour');
  run();
  setInterval(run, INTERVAL_MS);
}

module.exports = { startDepositCleanupJob };
