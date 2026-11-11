const axios      = require('axios');
const nodeCrypto = require('crypto');
const { HDNodeWallet, JsonRpcProvider, formatEther, parseEther, isAddress } = require('ethers');
const { BIP32Factory } = require('bip32');
const ecc     = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const { mnemonicToSeedSync } = require('bip39');
const prisma = require('../db');

const bip32 = BIP32Factory(ecc);

const TOKEN        = process.env.BLOCKCYPHER_TOKEN;
const PUBLIC_URL   = process.env.RAILWAY_PUBLIC_URL;
const CALLBACK_URL = PUBLIC_URL ? `${PUBLIC_URL}/api/webhooks/blockcypher` : null;

const CHAIN = { BTC: 'btc/main', LTC: 'ltc/main', DOGE: 'doge/main' };

// BIP44 coin type + P2PKH version byte per chain
const UTXO_META = {
  BTC:  { coinType: 0, version: 0x00 },
  LTC:  { coinType: 2, version: 0x30 },
  DOGE: { coinType: 3, version: 0x1e },
};

// Network params for bitcoinjs-lib (P2PKH addresses)
const NETWORKS = {
  BTC: bitcoin.networks.bitcoin,
  LTC: {
    messagePrefix: '\x19Litecoin Signed Message:\n', bech32: 'ltc',
    bip32: { public: 0x019da462, private: 0x019d9cfe }, pubKeyHash: 0x30, scriptHash: 0x32, wif: 0xb0,
  },
  DOGE: {
    messagePrefix: '\x19Dogecoin Signed Message:\n', bech32: 'doge',
    bip32: { public: 0x02facafd, private: 0x02fac398 }, pubKeyHash: 0x1e, scriptHash: 0x16, wif: 0x9e,
  },
};

// Smallest output each network relays: a share below it can't be left as change.
const DUST = { BTC: 546, LTC: 5460, DOGE: 1_000_000 };

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const trimSats = sats => (sats / 1e8).toFixed(8).replace(/\.?0+$/, '') || '0';
const usable = v => { const t = String(v ?? '').trim(); return t && !t.startsWith('<') ? t : ''; };

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function toBase58Check(versionByte, pubKeyHash) {
  const payload  = Buffer.concat([Buffer.from([versionByte]), pubKeyHash]);
  const checksum = nodeCrypto.createHash('sha256')
    .update(nodeCrypto.createHash('sha256').update(payload).digest())
    .digest()
    .slice(0, 4);
  const full = Buffer.concat([payload, checksum]);

  let num = BigInt('0x' + full.toString('hex'));
  let str = '';
  while (num > 0n) { str = BASE58_CHARS[Number(num % 58n)] + str; num /= 58n; }
  for (const byte of full) { if (byte !== 0) break; str = '1' + str; }
  return str;
}

async function getSetting(key) {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row?.value || null;
}

// The seed new addresses are derived from: Settings → Crypto first, then BTC_HD_SEED.
async function getHdPhrase() {
  const phrase = usable(await getSetting('btc_hd_seed')) || usable(process.env.BTC_HD_SEED);
  if (!phrase) throw fail('BTC HD Seed not configured — add it in Settings → Crypto or in your .env.', 500);
  return phrase;
}

// Every seed an address may have come from (the setting and the env var can differ
// when one of them was changed after deposits were made).
async function seedCandidates() {
  const list = [usable(await getSetting('btc_hd_seed')), usable(process.env.BTC_HD_SEED)].filter(Boolean);
  return [...new Set(list)];
}

// Derive a unique P2PKH address from a BIP44 seed — no API call, no cost.
async function deriveUtxoAddress(currency, depositId) {
  const phrase = await getHdPhrase();
  const { coinType, version } = UTXO_META[currency];
  const node    = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/${coinType}'/0'/0/${depositId}`);
  const pubKey  = Buffer.from(node.publicKey.slice(2), 'hex'); // strip '0x'
  const sha256  = nodeCrypto.createHash('sha256').update(pubKey).digest();
  const hash160 = nodeCrypto.createHash('ripemd160').update(sha256).digest();
  return toBase58Check(version, hash160);
}

// The signing key of a deposit address: m/44'/{coin}'/0'/0/{depositId}, from whichever
// seed actually produced that address. Signing with a key that doesn't match the
// address is what makes a node answer "Script was NOT verified successfully", so
// nothing is signed unless the derived address is the deposit's own.
async function depositKey(currency, dep) {
  const network = NETWORKS[currency];
  if (!network) throw fail(`Unsupported currency: ${currency}`);
  const path = `m/44'/${UTXO_META[currency].coinType}'/0'/0/${dep.id}`;
  const seeds = await seedCandidates();
  if (!seeds.length) throw fail('BTC HD Seed not configured — add it in Settings → Crypto.', 500);
  for (const phrase of seeds) {
    const child = bip32.fromSeed(mnemonicToSeedSync(phrase), network).derivePath(path);
    const { address } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(child.publicKey), network });
    if (address === dep.address) return { child, address, network };
  }
  throw fail(`Deposit #${dep.id}: its address ${dep.address} does not come from the configured HD seed${seeds.length > 1 ? 's' : ''} at index ${dep.id}. It was created with another seed: put that seed back in Settings → Crypto (or BTC_HD_SEED) to move these funds.`, 409);
}

function isValidUtxoAddress(currency, address) {
  try { bitcoin.address.toOutputScript(String(address || ''), NETWORKS[currency]); return true; }
  catch { return false; }
}

async function feePerByte(currency) {
  const fallback = { BTC: 10, LTC: 10, DOGE: 1000 }[currency];
  try {
    const { data } = await axios.get(`https://api.blockcypher.com/v1/${CHAIN[currency]}?token=${TOKEN}`, { timeout: 8000 });
    return Math.max(1, Math.ceil((data.low_fee_per_kb || data.medium_fee_per_kb || fallback * 1000) / 1000));
  } catch { return fallback; }
}

// P2PKH size: 10 (overhead) + 148 per input + 34 per output
const txFee = (rate, inputs, outputs) => rate * (10 + inputs * 148 + outputs * 34);

async function listUtxos(currency, address) {
  const { data } = await axios.get(
    `https://api.blockcypher.com/v1/${CHAIN[currency]}/addrs/${address}?unspentOnly=true&includeScript=true&token=${TOKEN}`,
    { timeout: 10000 });
  // Confirmed outputs only: an unconfirmed one may still be replaced
  return (data.txrefs || []).filter(u => !u.spent);
}

// Builds, signs and broadcasts a P2PKH transaction spending every UTXO of a deposit
// address: `send` to `destination`, `change` back to the deposit address.
async function spendDeposit(currency, key, utxos, outputs) {
  const psbt = new bitcoin.Psbt({ network: key.network });
  // DOGE transactions are larger than the default limit for fee-rate sanity checks
  psbt.setMaximumFeeRate(currency === 'DOGE' ? 1e9 : 5000);
  for (const u of utxos) {
    const { data: tx } = await axios.get(
      `https://api.blockcypher.com/v1/${CHAIN[currency]}/txs/${u.tx_hash}?includeHex=true&token=${TOKEN}`,
      { timeout: 10000 });
    psbt.addInput({ hash: u.tx_hash, index: u.tx_output_n, nonWitnessUtxo: Buffer.from(tx.hex, 'hex') });
  }
  for (const o of outputs) psbt.addOutput(o);
  for (let i = 0; i < utxos.length; i++) psbt.signInput(i, key.child);
  if (!psbt.validateSignaturesOfAllInputs((pub, hash, sig) => ecc.verify(hash, pub, sig))) {
    throw fail('Signature check failed before broadcast', 500);
  }
  psbt.finalizeAllInputs();
  const { data } = await axios.post(
    `https://api.blockcypher.com/v1/${CHAIN[currency]}/txs/push?token=${TOKEN}`,
    { tx: psbt.extractTransaction().toHex() },
    { timeout: 15000 });
  return data.tx?.hash;
}

// One sweep of a deposit address: sends everything but `keep` (the other side's
// share, returned to the address as change). A `keep` below dust goes along.
// Returns { txHash, sent, fee, settlesOther } or { skipped: reason }.
async function sweepDepositUtxo(currency, dep, destination, keep) {
  if (!TOKEN) throw fail('BLOCKCYPHER_TOKEN not configured.', 500);
  if (!isValidUtxoAddress(currency, destination)) throw fail(`Invalid ${currency} destination address: ${destination}`);
  const key = await depositKey(currency, dep);
  const utxos = await listUtxos(currency, dep.address);
  const total = utxos.reduce((s, u) => s + u.value, 0);
  if (total === 0) return { empty: true };

  const dust = DUST[currency];
  let settlesOther = false;
  if (keep > 0 && keep < dust) { keep = 0; settlesOther = true; }
  if (keep >= total) return { skipped: 'nothing left for this share on the address' };

  const rate = await feePerByte(currency);
  const fee  = txFee(rate, utxos.length, keep > 0 ? 2 : 1);
  const send = total - keep - fee;
  if (send < dust) return { skipped: `share too small to cover the network fee (~${fee} sats)` };

  const outputs = [{ address: destination, value: send }];
  if (keep > 0) outputs.push({ address: dep.address, value: keep });
  const txHash = await spendDeposit(currency, key, utxos, outputs);
  return { txHash, sent: send, fee, settlesOther };
}

// The coins customers can pay with right now: BTC / LTC / DOGE need the HD seed and
// BlockCypher, ETH its seed and the Alchemy webhook (an order's ETH payments are
// only seen through it), XMR its address.
async function payableCoins() {
  const coins = [];
  if ((await seedCandidates()).length && usable(TOKEN) && CALLBACK_URL) coins.push('BTC', 'LTC', 'DOGE');
  if (usable(process.env.ETH_HD_SEED) && usable(process.env.ALCHEMY_API_KEY)
    && usable(process.env.ALCHEMY_WEBHOOK_ID) && usable(process.env.ALCHEMY_AUTH_TOKEN)) coins.push('ETH');
  if (usable(await getSetting('xmr_address')) || usable(process.env.XMR_DEPOSIT_ADDRESS)) coins.push('XMR');
  return coins;
}

async function generateDepositAddress(currency, depositId) {
  switch (currency) {
    case 'BTC':
    case 'LTC':
    case 'DOGE': {
      if (!TOKEN) throw fail('BLOCKCYPHER_TOKEN not configured on the server.', 500);
      if (!CALLBACK_URL) throw fail('RAILWAY_PUBLIC_URL not configured — cannot register BlockCypher webhook.', 500);

      const address = await deriveUtxoAddress(currency, depositId);
      const chain   = CHAIN[currency];

      let hookId;
      try {
        const res = await axios.post(
          `https://api.blockcypher.com/v1/${chain}/hooks?token=${TOKEN}`,
          { event: 'confirmed-tx', address, url: CALLBACK_URL }
        );
        hookId = res.data.id;
      } catch (e) {
        const msg = e.response?.data?.error || e.response?.data?.errors?.join(', ') || e.message;
        throw fail(`BlockCypher error: ${msg}`, 502);
      }

      return { address, hookId, ethIndex: null };
    }

    case 'ETH': {
      const phrase = process.env.ETH_HD_SEED;
      if (!phrase) throw fail('ETH_HD_SEED not configured.', 500);

      const wallet  = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/60'/0'/0/${depositId}`);
      const address = wallet.address;

      if (process.env.ALCHEMY_AUTH_TOKEN && process.env.ALCHEMY_WEBHOOK_ID) {
        try {
          await axios.patch(
            'https://dashboard.alchemy.com/api/update-webhook-addresses',
            {
              webhook_id:          process.env.ALCHEMY_WEBHOOK_ID,
              addresses_to_add:    [address],
              addresses_to_remove: [],
            },
            { headers: { 'X-Alchemy-Token': process.env.ALCHEMY_AUTH_TOKEN } }
          );
        } catch (e) {
          console.error('Alchemy webhook address registration failed:', e.message);
        }
      }

      return { address, hookId: null, ethIndex: depositId };
    }

    case 'XMR': {
      const address = await getSetting('xmr_address') || process.env.XMR_DEPOSIT_ADDRESS;
      if (!address) throw fail('XMR deposit address not set — go to Admin → Settings → Crypto and enter your Monero wallet address.', 500);
      return { address, hookId: null, ethIndex: null };
    }

    default:
      throw fail('Unsupported currency.', 422);
  }
}

// Deletes a BlockCypher address webhook. Errors are logged but never thrown — a
// 404 (already deleted or expired) must not block cleanup flows.
async function deleteBlockCypherForwarding(currency, hookId) {
  const chain = CHAIN[currency];
  if (!chain || !hookId || !TOKEN) return;
  try {
    await axios.delete(`https://api.blockcypher.com/v1/${chain}/hooks/${hookId}?token=${TOKEN}`);
  } catch (e) {
    console.error(`BlockCypher hook delete failed (${currency} / ${hookId}):`, e.message);
  }
}

// Every payment a customer made to a deposit address: one entry per confirmed incoming
// transaction, oldest first ({ hash, amount }), plus whether one is still unconfirmed.
// The change our own sweeps and refunds send back to the address is not a payment: a
// transaction that also spends from the address is ours, so it is left out.
// A customer may send to the same address again and again: each one is a new payment.
async function incomingPayments(deposit) {
  const { currency, address } = deposit;
  if (CHAIN[currency]) {
    if (!TOKEN) throw fail('BLOCKCYPHER_TOKEN not configured.', 500);
    const { data } = await axios.get(
      `https://api.blockcypher.com/v1/${CHAIN[currency]}/addrs/${address}?limit=2000&token=${TOKEN}`,
      { timeout: 15000 });
    const refs = data.txrefs || []; // confirmed only (unconfirmed ones are in unconfirmed_txrefs)
    const ours = new Set(refs.filter(r => r.tx_input_n >= 0).map(r => r.tx_hash));
    const byTx = new Map();
    for (const r of refs) {
      if (r.tx_input_n !== -1 || ours.has(r.tx_hash)) continue;
      const cur = byTx.get(r.tx_hash) || { hash: r.tx_hash, sats: 0, height: r.block_height };
      cur.sats += r.value;
      byTx.set(r.tx_hash, cur);
    }
    const payments = [...byTx.values()].sort((a, b) => a.height - b.height).map(p => ({ hash: p.hash, amount: p.sats / 1e8 }));
    return { payments, pending: (data.unconfirmed_n_tx || 0) > 0 };
  }
  if (currency === 'ETH') {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) throw fail('ALCHEMY_API_KEY not configured.', 500);
    const { data } = await axios.post(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`, {
      jsonrpc: '2.0', id: 1, method: 'alchemy_getAssetTransfers',
      params: [{ fromBlock: '0x0', toAddress: address, category: ['external'], excludeZeroValue: true, withMetadata: false, maxCount: '0x3e8' }],
    }, { timeout: 15000 });
    if (data.error) throw fail(`Alchemy: ${data.error.message}`, 502);
    const payments = (data.result?.transfers || [])
      .filter(t => t.asset === 'ETH' && Number(t.value) > 0 && String(t.from).toLowerCase() !== address.toLowerCase())
      .sort((a, b) => parseInt(a.blockNum, 16) - parseInt(b.blockNum, 16))
      .map(t => ({ hash: t.hash, amount: Number(t.value) }));
    return { payments, pending: false };
  }
  return { payments: [], pending: false }; // XMR: one shared address, checked by hand
}

// Sends `amount` (crypto) from a deposit's own address to `destination`, the network fee
// taken off what is sent; whatever else is on the address stays there (the commission,
// the rest of the deposit). BTC / LTC / DOGE / ETH only: XMR has no key here.
async function refundFromDeposit(dep, amount, destination) {
  const qty = Number(amount);
  if (!(qty > 0)) throw fail('Nothing to refund');

  if (dep.currency === 'ETH') {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!process.env.ETH_HD_SEED || !apiKey) throw fail('ETH is not configured', 500);
    if (!isAddress(destination)) throw fail('Invalid ETH refund address');
    if (dep.ethIndex == null) throw fail('This deposit has no ETH key index');
    const provider = new JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`);
    const wallet   = HDNodeWallet.fromPhrase(process.env.ETH_HD_SEED, undefined, `m/44'/60'/0'/0/${dep.ethIndex}`).connect(provider);
    if (wallet.address.toLowerCase() !== dep.address.toLowerCase()) throw fail('The deposit address does not match ETH_HD_SEED', 409);
    const feeData  = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
    if (!gasPrice) throw fail('Could not fetch gas price from Alchemy', 500);
    const want    = parseEther(qty.toFixed(8));
    const balance = await provider.getBalance(wallet.address);
    if (balance < want) throw fail('The deposit address holds less than the amount to refund', 409);
    const value = want - 21000n * gasPrice;
    if (value <= 0n) throw fail('The amount is too small to cover the network fee', 409);
    const tx = await wallet.sendTransaction({ to: destination, value, gasLimit: 21000n, gasPrice });
    return { txHash: tx.hash, sent: formatEther(value) };
  }

  const currency = dep.currency;
  if (!CHAIN[currency]) throw fail(`${currency} refunds are sent by hand from the shop's wallet`);
  if (!TOKEN) throw fail('BLOCKCYPHER_TOKEN not configured.', 500);
  if (!isValidUtxoAddress(currency, destination)) throw fail(`Invalid ${currency} refund address`);

  const key   = await depositKey(currency, dep);
  const utxos = await listUtxos(currency, dep.address);
  const total = utxos.reduce((s, u) => s + u.value, 0);
  const want  = Math.round(qty * 1e8);
  if (total < want) throw fail('The deposit address holds less than the amount to refund', 409);

  // The rest goes back to the deposit address, unless it is dust (then it goes with the refund)
  const dust = DUST[currency];
  const rate = await feePerByte(currency);
  let change = total - want;
  if (change < dust) change = 0;
  const fee  = txFee(rate, utxos.length, change ? 2 : 1);
  const send = (change ? want : total) - fee;
  if (send < dust) throw fail('The amount is too small to cover the network fee', 409);

  const outputs = [{ address: destination, value: send }];
  if (change) outputs.push({ address: dep.address, value: change });
  const txHash = await spendDeposit(currency, key, utxos, outputs);
  return { txHash, sent: trimSats(send) };
}

module.exports = {
  CHAIN, DUST,
  generateDepositAddress, deleteBlockCypherForwarding, deriveUtxoAddress,
  payableCoins, isValidUtxoAddress, depositKey, sweepDepositUtxo, incomingPayments, refundFromDeposit,
};
