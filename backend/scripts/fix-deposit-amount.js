// Corrects a manually confirmed deposit whose crypto amount was entered by mistake
// (e.g. 48 BTC typed instead of 48 USD). Dry-run unless --apply is passed.
// Usage: node scripts/fix-deposit-amount.js <depositId> <correctUsdReceived> [--apply]
// The USD value is converted with the rate stored on the original transaction, and
// the same commission percentage is kept. The customer's holding is reduced by the
// difference (it refuses if the customer has already spent part of it).
try { require('dotenv').config(); } catch (_) {}
const prisma = require('../src/db');
const balanceService = require('../src/services/balance.service');

async function main() {
  const [idArg, usdArg] = process.argv.slice(2);
  const apply = process.argv.includes('--apply');
  const id = parseInt(idArg);
  const correctUsd = parseFloat(usdArg);
  if (!id || !(correctUsd > 0)) throw new Error('Usage: fix-deposit-amount.js <depositId> <correctUsdReceived> [--apply]');

  const dep = await prisma.deposit.findUnique({ where: { id } });
  if (!dep) throw new Error(`Deposit ${id} not found.`);
  if (dep.status !== 'confirmed' || !dep.transactionId) throw new Error(`Deposit ${id} is not a confirmed, credited deposit.`);
  const txn = await prisma.transaction.findUnique({ where: { id: dep.transactionId } });
  const rate = parseFloat(txn?.rate);
  if (!(rate > 0)) throw new Error('No rate stored on the transaction; cannot convert USD to crypto.');

  const pct = parseFloat(dep.commissionPct);
  const gross = balanceService.round8(correctUsd / rate);
  const { commission, net } = balanceService.splitDeposit(gross, pct);
  const netUsd = balanceService.round2(net * rate);
  const oldNet = parseFloat(dep.netAmount);
  const delta = balanceService.round8(oldNet - net);

  const holding = await prisma.walletHolding.findUnique({ where: { userId_currency: { userId: dep.userId, currency: dep.currency } } });
  const held = holding ? parseFloat(holding.amount) : 0;

  console.log(JSON.stringify({
    depositId: id, userId: dep.userId, currency: dep.currency, rate, commissionPct: pct,
    before: { gross: parseFloat(dep.amountReceived), commission: parseFloat(dep.commissionAmount), net: oldNet, usdCredited: parseFloat(dep.usdCredited) },
    after:  { gross, commission, net, usdCredited: netUsd },
    holdingNow: held, debitFromHolding: delta, holdingAfter: balanceService.round8(held - delta),
    shopSweptAt: dep.shopSweptAt, reserveSweptAt: dep.reserveSweptAt,
  }, null, 2));

  if (delta <= 0) throw new Error('Nothing to reduce (corrected amount is not lower than the credited one).');
  if (held + 1e-9 < delta) throw new Error('Customer holding is lower than the amount to remove: part was already spent. Handle manually.');
  if (dep.shopSweptAt || dep.reserveSweptAt) throw new Error('This deposit was already swept; correct it manually.');
  if (!apply) { console.log('\nDry run only. Re-run with --apply to write.'); return; }

  await prisma.$transaction(async tx => {
    await balanceService.debit(tx, dep.userId, dep.currency, delta);
    await tx.deposit.update({
      where: { id },
      data: { amountReceived: gross, commissionAmount: commission, netAmount: net, usdCredited: netUsd },
    });
    await tx.transaction.update({
      where: { id: dep.transactionId },
      data: {
        amount: netUsd, cryptoAmount: net,
        note: `Deposit #${id} - corrected: ${gross} ${dep.currency} received (${correctUsd} USD), ${pct}% fee (${commission} ${dep.currency}). Entry error fixed.`,
      },
    });
  });
  console.log('\nApplied.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
