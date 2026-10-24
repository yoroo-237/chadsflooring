const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const sweepService = require('../../services/sweep.service');

const DEFAULT_PCT = 10;

const COMMISSION_SETTING_KEYS = {
  pct:  'super_sweep_commission_pct',
  BTC:  'super_btc_commission_address',
  LTC:  'super_ltc_commission_address',
  DOGE: 'super_doge_commission_address',
  ETH:  'super_eth_commission_address',
};

// The commission is taken from each customer deposit when it is credited and
// belongs to the super admin's reserve fund. Admins have no view of it: their
// sweep only collects the customer-credited share. Legacy logs (single sweep
// that split on-chain) are shown to admins without the reserve side.
const isSuper = req => req.user?.role === 'superadmin';
const redactLog = ({ commissionAddress, commissionTxHash, commissionAmount, commissionPct, ...log }) => log;

async function getCommissionSettings(req, res) {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(COMMISSION_SETTING_KEYS) } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));

  const full = {
    commissionPct:      map[COMMISSION_SETTING_KEYS.pct] != null ? Number(map[COMMISSION_SETTING_KEYS.pct]) : DEFAULT_PCT,
    btcCommissionAddress:  map[COMMISSION_SETTING_KEYS.BTC]  || '',
    ltcCommissionAddress:  map[COMMISSION_SETTING_KEYS.LTC]  || '',
    dogeCommissionAddress: map[COMMISSION_SETTING_KEYS.DOGE] || '',
    ethCommissionAddress:  map[COMMISSION_SETTING_KEYS.ETH]  || '',
  };
  return success(res, full);
}

async function updateCommissionSettings(req, res) {
  const { commissionPct, btcCommissionAddress, ltcCommissionAddress, dogeCommissionAddress, ethCommissionAddress } = req.body;

  const updates = {};
  if (commissionPct !== undefined) {
    const pct = Number(commissionPct);
    if (!Number.isFinite(pct) || pct < 0 || pct >= 100) return error(res, 'commissionPct must be a number from 0 to 99.', 422);
    updates[COMMISSION_SETTING_KEYS.pct] = String(pct);
  }
  if (btcCommissionAddress  !== undefined) updates[COMMISSION_SETTING_KEYS.BTC]  = String(btcCommissionAddress);
  if (ltcCommissionAddress  !== undefined) updates[COMMISSION_SETTING_KEYS.LTC]  = String(ltcCommissionAddress);
  if (dogeCommissionAddress !== undefined) updates[COMMISSION_SETTING_KEYS.DOGE] = String(dogeCommissionAddress);
  if (ethCommissionAddress  !== undefined) updates[COMMISSION_SETTING_KEYS.ETH]  = String(ethCommissionAddress);

  await prisma.$transaction(
    Object.entries(updates).map(([key, value]) =>
      prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
  );

  return success(res, { updated: true });
}

async function listSweepLogs(req, res) {
  const logs = await prisma.sweepLog.findMany({
    where: isSuper(req) ? {} : { kind: { in: ['shop', 'legacy'] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { triggeredByUser: { select: { id: true, username: true } } },
  });
  return success(res, { logs: isSuper(req) ? logs : logs.map(redactLog) });
}

// Admin: sweeps the customer-credited share of every confirmed deposit to the shop address.
async function sweepShopUtxo(req, res) {
  return success(res, await sweepService.sweepUtxo('shop', req.params.currency, req.user.id));
}
async function sweepShopEth(req, res) {
  return success(res, await sweepService.sweepEth('shop', req.user.id));
}

// Super admin: sweeps the deposit commissions to the reserve address.
async function sweepReserveUtxo(req, res) {
  return success(res, await sweepService.sweepUtxo('reserve', req.params.currency, req.user.id));
}
async function sweepReserveEth(req, res) {
  return success(res, await sweepService.sweepEth('reserve', req.user.id));
}

async function getShopPending(req, res) {
  return success(res, { pending: await sweepService.pendingTotals('shop') });
}

async function getReservePending(req, res) {
  const [pending, collected] = await Promise.all([
    sweepService.pendingTotals('reserve'),
    prisma.deposit.groupBy({
      by: ['currency'], where: { status: 'confirmed', commissionAmount: { gt: 0 } },
      _sum: { commissionAmount: true },
    }),
  ]);
  return success(res, {
    pending,
    collected: collected.map(r => ({ currency: r.currency, amount: parseFloat(r._sum.commissionAmount || 0) })),
  });
}

module.exports = {
  getCommissionSettings, updateCommissionSettings, listSweepLogs,
  sweepShopUtxo, sweepShopEth, sweepReserveUtxo, sweepReserveEth,
  getShopPending, getReservePending,
};
