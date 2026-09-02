# Guide complet : commission 90/10 sur sweeps crypto (avec code)

Réutilisable sur tout projet **Express + Prisma + wallets HD dérivés + BlockCypher (UTXO)
/ Alchemy-ethers (ETH)**. Si l'autre site n'utilise pas exactement cette stack, la section 0
explique quoi chercher pour transposer.

Adapte les noms `TABLE`, chemins de fichiers, et valeurs `XXX_A_ADAPTER` à ton projet.

---

## 0. Ce qu'il faut identifier avant de commencer

Ouvre le projet cible et réponds à ces 4 questions avant d'écrire une ligne de code :

1. **Où sont générées les adresses de dépôt ?** Cherche `HDNodeWallet`, `derivePath`,
   `m/44'/`, ou une fonction `generateDepositAddress`. Note le chemin de dérivation
   utilisé par devise (ex. `m/44'/0'/0'/0/{id}` pour BTC).
2. **Où est le sweep existant ?** Cherche `sweep`, `forward`, `consolidat`, `withdraw`,
   `hotwallet`. S'il n'existe pas du tout (fonds auto-forwardés directement par le
   provider), il faut d'abord désactiver l'auto-forward et créer un sweep manuel avant
   de pouvoir y greffer un split — sinon il n'y a rien à intercepter.
3. **Comment sont stockés les réglages globaux** (adresse de destination, seed HD) ?
   Table clé/valeur (`SiteSetting`), variables d'environnement, ou table dédiée ?
4. **Quel est le système de rôles actuel ?** Cherche `requireAdmin`, `role`, le champ
   `role` dans le modèle `User`. Un champ `String` libre ne demande pas de migration
   pour ajouter `superadmin`. Un `enum` Prisma demande d'ajouter la valeur à l'enum.

---

## 1. Schéma de base de données (Prisma)

```prisma
// Ajout pur — aucune table/colonne existante modifiée.
model SweepLog {
  id                Int      @id @default(autoincrement())
  currency          String
  commissionPct     Decimal  @db.Decimal(5, 2)
  totalAmount       Decimal  @db.Decimal(18, 8)
  mainAmount        Decimal  @db.Decimal(18, 8)
  mainAddress       String
  mainTxHash        String?
  commissionAmount  Decimal  @db.Decimal(18, 8)
  commissionAddress String
  commissionTxHash  String?
  addressCount      Int      @default(0)
  triggeredBy       Int?
  createdAt         DateTime @default(now())

  triggeredByUser User? @relation(fields: [triggeredBy], references: [id], onDelete: SetNull)

  @@index([currency])
  @@index([createdAt])
}
```

Et sur le modèle `User`, ajoute la relation inverse :
```prisma
model User {
  // ...champs existants inchangés...
  sweepLogs SweepLog[]
}
```

Si `role` est déjà `String @default("customer")`, rien d'autre à faire — `"superadmin"`
est juste une nouvelle valeur possible, aucune migration de structure nécessaire.

### Déploiement du schéma — check-list obligatoire avant toute synchro sur la prod

```bash
# 1. Vérifier qu'aucune contrainte nouvelle ne va échouer sur des données existantes
#    (exemple générique — adapte le nom de colonne si tu as un doute sur une autre
#    contrainte unique que ta migration introduirait)
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const dups = await prisma.\$queryRawUnsafe('SELECT username, count(*) FROM \"User\" GROUP BY username HAVING count(*) > 1');
  console.log('duplicates:', dups);
  await prisma.\$disconnect();
})();
"

# 2. Si aucun doublon -> synchro additive (crée les nouvelles tables/colonnes uniquement)
DATABASE_URL="<url de la base de PROD>" npx prisma db push --accept-data-loss

# 3. Vérifier immédiatement après que rien d'existant n'a bougé
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  console.log('users:',        await prisma.\$queryRawUnsafe('SELECT count(*) FROM \"User\"'));
  console.log('deposits:',     await prisma.\$queryRawUnsafe('SELECT count(*) FROM \"Deposit\"'));
  console.log('total balance:',await prisma.\$queryRawUnsafe('SELECT sum(balance) FROM \"User\"'));
  await prisma.\$disconnect();
})();
"
```
`--accept-data-loss` est le nom Prisma donné à toute opération qui *pourrait* échouer
sur des données existantes (ex. ajout d'une contrainte unique) — sur un ajout pur de
table, il n'y a en réalité **aucune perte** possible ; l'étape 1 sert justement à le
confirmer avant de lancer l'étape 2 les yeux fermés.

---

## 2. Middleware de permissions

`src/middlewares/auth.js` :
```js
function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Super admin access required.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, requireApiKey, optionalAuth };
```

Vérifie que le login signe bien le rôle dans le JWT (sinon le frontend ne peut jamais
savoir qui est superadmin) :
```js
// src/services/auth.service.js — doit déjà ressembler à ça, sinon ajoute `role`
const accessToken = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
```

---

## 3. Isolation des réglages sensibles

Si les réglages sont dans une table clé/valeur générique exposée à tout admin via
`GET /admin/settings`, préfixe les clés sensibles et filtre-les hors de l'endpoint
générique :

```js
// src/controllers/admin/settings.controller.js
async function getAllSettings(req, res) {
  const rows = await prisma.siteSetting.findMany({ orderBy: { key: 'asc' } });
  const visible = rows.filter(r => !r.key.startsWith('super_'));   // <-- ajouté
  return success(res, { settings: Object.fromEntries(visible.map(r => [r.key, r.value])) });
}

async function updateSettings(req, res) {
  const updates = req.body;
  const entries = Object.entries(updates).filter(([key]) => !key.startsWith('super_')); // <-- ajouté
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.siteSetting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } })
    )
  );
  return success(res, { updated: true });
}
```

---

## 4. Contrôleur superadmin — le cœur du système

Fichier `src/controllers/admin/superadmin.controller.js`. Remplace `HDNodeWallet`,
`buildDerSig`, `CHAIN`/`COIN_TYPE`/`ADDR_SETTING` par les équivalents déjà présents
dans TON sweep existant (section 0, point 1 et 2) — ne réinvente pas la dérivation de
clé ni la signature, réutilise exactement ce que ton sweep normal utilise déjà.

```js
const { HDNodeWallet, ethers } = require('ethers');
const axios  = require('axios');
const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
// buildDerSig / CHAIN / COIN_TYPE / ADDR_SETTING : importe-les depuis TON contrôleur
// de sweep UTXO existant plutôt que de les dupliquer (voir note en fin de fichier).
const { buildDerSig, CHAIN, COIN_TYPE, ADDR_SETTING } = require('./utxo.controller');

const DUST = 546;          // seuil réseau Bitcoin — adapte si LTC/DOGE ont un seuil différent
const DEFAULT_PCT = 10;

const COMMISSION_SETTING_KEYS = {
  pct:  'super_sweep_commission_pct',
  BTC:  'super_btc_commission_address',
  LTC:  'super_ltc_commission_address',
  DOGE: 'super_doge_commission_address',
  ETH:  'super_eth_commission_address',
};

// ── Réglages ────────────────────────────────────────────────────────────────
async function getCommissionSettings(req, res) {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: Object.values(COMMISSION_SETTING_KEYS) } } });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return success(res, {
    commissionPct:         map[COMMISSION_SETTING_KEYS.pct] != null ? Number(map[COMMISSION_SETTING_KEYS.pct]) : DEFAULT_PCT,
    btcCommissionAddress:  map[COMMISSION_SETTING_KEYS.BTC]  || '',
    ltcCommissionAddress:  map[COMMISSION_SETTING_KEYS.LTC]  || '',
    dogeCommissionAddress: map[COMMISSION_SETTING_KEYS.DOGE] || '',
    ethCommissionAddress:  map[COMMISSION_SETTING_KEYS.ETH]  || '',
  });
}

async function updateCommissionSettings(req, res) {
  const { commissionPct, btcCommissionAddress, ltcCommissionAddress, dogeCommissionAddress, ethCommissionAddress } = req.body;
  const updates = {};
  if (commissionPct !== undefined) {
    const pct = Number(commissionPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return error(res, 'commissionPct must be a number between 0 and 100.', 422);
    updates[COMMISSION_SETTING_KEYS.pct] = String(pct);
  }
  if (btcCommissionAddress  !== undefined) updates[COMMISSION_SETTING_KEYS.BTC]  = String(btcCommissionAddress);
  if (ltcCommissionAddress  !== undefined) updates[COMMISSION_SETTING_KEYS.LTC]  = String(ltcCommissionAddress);
  if (dogeCommissionAddress !== undefined) updates[COMMISSION_SETTING_KEYS.DOGE] = String(dogeCommissionAddress);
  if (ethCommissionAddress  !== undefined) updates[COMMISSION_SETTING_KEYS.ETH]  = String(ethCommissionAddress);
  await prisma.$transaction(
    Object.entries(updates).map(([key, value]) => prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } }))
  );
  return success(res, { updated: true });
}

async function listSweepLogs(req, res) {
  const logs = await prisma.sweepLog.findMany({
    orderBy: { createdAt: 'desc' }, take: 200,
    include: { triggeredByUser: { select: { id: true, username: true } } },
  });
  return success(res, { logs });
}

async function getCommissionConfig(currency) {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: [COMMISSION_SETTING_KEYS.pct, COMMISSION_SETTING_KEYS[currency]] } } });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    pct: map[COMMISSION_SETTING_KEYS.pct] != null ? Number(map[COMMISSION_SETTING_KEYS.pct]) : DEFAULT_PCT,
    commissionAddress: map[COMMISSION_SETTING_KEYS[currency]] || '',
  };
}

// ── Sweep UTXO (BTC/LTC/DOGE) avec split — LA partie sensible ───────────────
async function sweepUtxoWithCommission(req, res, next) {
  try {
    const { currency } = req.params;
    if (!['BTC', 'LTC', 'DOGE'].includes(currency)) return error(res, 'Invalid currency', 422);

    const TOKEN = process.env.BLOCKCYPHER_TOKEN;
    if (!TOKEN) return error(res, 'BLOCKCYPHER_TOKEN not configured.', 500);

    const seedSetting = await prisma.siteSetting.findUnique({ where: { key: 'btc_hd_seed' } });
    const phrase = seedSetting?.value || process.env.BTC_HD_SEED;
    if (!phrase) return error(res, 'HD seed not configured.', 500);

    const destSetting = await prisma.siteSetting.findUnique({ where: { key: ADDR_SETTING[currency] } });
    if (!destSetting?.value) return error(res, `${currency} destination address not configured.`, 400);
    const destination = destSetting.value;

    const { pct, commissionAddress } = await getCommissionConfig(currency);
    if (!commissionAddress) return error(res, `${currency} commission address not configured.`, 400);

    const chain    = CHAIN[currency];
    const coinType = COIN_TYPE[currency];

    const chainInfo      = await axios.get(`https://api.blockcypher.com/v1/${chain}?token=${TOKEN}`);
    const mediumFeePerKb = chainInfo.data.medium_fee_per_kb || chainInfo.data.low_fee_per_kb || 20000;

    const deposits = await prisma.deposit.findMany({
      where:  { currency, status: { in: ['confirmed', 'awaiting', 'partial'] } },
      select: { id: true, address: true },
    });

    const swept = [], skipped = [];
    let totalMain = 0, totalCommission = 0;

    // Sous le seuil dust -> tout part au principal plutôt que de créer une sortie invalide.
    function split(sendAmount) {
      const commission = Math.floor(sendAmount * pct / 100);
      if (commission < DUST || (sendAmount - commission) < DUST) return { main: sendAmount, commission: 0 };
      return { main: sendAmount - commission, commission };
    }
    function buildOutputs(sendAmount) {
      const { main, commission } = split(sendAmount);
      const outputs = [{ addresses: [destination], value: main }];
      if (commission > 0) outputs.push({ addresses: [commissionAddress], value: commission });
      return { outputs, main, commission };
    }

    for (const dep of deposits) {
      try {
        const balRes = await axios.get(`https://api.blockcypher.com/v1/${chain}/addrs/${dep.address}/balance?token=${TOKEN}`);
        const balance = balRes.data.balance || 0;
        if (balance === 0) { skipped.push({ address: dep.address, reason: 'empty' }); continue; }

        // ── Boucle de convergence des frais ──────────────────────────────
        // Une 2e sortie change la taille de la tx par rapport au sweep à une
        // seule sortie : une estimation fixe ne suffit pas, il faut boucler
        // jusqu'à ce que le fee utilisé pour construire la tx corresponde
        // EXACTEMENT à celui rapporté par l'API pour cette tx précise.
        // Tant que rien n'est diffusé (`/txs/send`), aucun fonds ne bouge —
        // un échec ici veut juste dire "réessayer plus tard", pas "perdu".
        let fee = Math.ceil(300 * mediumFeePerKb / 1000);
        let outputs, main, commission, newTxRes;
        let converged = false;

        for (let attempt = 0; attempt < 5; attempt++) {
          const sendAmount = balance - fee;
          if (sendAmount < DUST) {
            skipped.push({ address: dep.address, reason: `balance (${balance} sats) too low to cover fees (~${fee} sats)` });
            break;
          }
          ({ outputs, main, commission } = buildOutputs(sendAmount));
          newTxRes = await axios.post(`https://api.blockcypher.com/v1/${chain}/txs/new?token=${TOKEN}`,
            { inputs: [{ addresses: [dep.address] }], outputs, preference: 'low' });
          const bcFee = newTxRes.data.fees;
          if (!bcFee || bcFee === fee) { converged = true; break; }
          fee = bcFee;
        }
        if (!converged) {
          if (!skipped.some(s => s.address === dep.address)) {
            skipped.push({ address: dep.address, reason: 'fee estimate did not converge after 5 attempts — try again later.' });
          }
          continue;
        }

        const wallet = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/${coinType}'/0'/0/${dep.id}`);
        const pubKey = wallet.publicKey.slice(2);

        const { tx, tosign } = newTxRes.data;
        const signatures = tosign.map(hash => buildDerSig(wallet.signingKey, hash));

        const sendRes = await axios.post(`https://api.blockcypher.com/v1/${chain}/txs/send?token=${TOKEN}`,
          { tx, tosign, signatures, pubkeys: tosign.map(() => pubKey) });

        const txHash = sendRes.data.tx?.hash;
        swept.push({
          address: dep.address, txHash, currency,
          amountMain:       (main / 1e8).toFixed(8).replace(/\.?0+$/, ''),
          amountCommission: (commission / 1e8).toFixed(8).replace(/\.?0+$/, ''),
        });
        totalMain += main; totalCommission += commission;

        await prisma.sweepLog.create({
          data: {
            currency, commissionPct: pct,
            totalAmount: (main + commission) / 1e8, mainAmount: main / 1e8,
            mainAddress: destination, mainTxHash: txHash,
            commissionAmount: commission / 1e8, commissionAddress, commissionTxHash: txHash,
            addressCount: 1, triggeredBy: req.user.id,
          },
        });
      } catch (e) {
        const errData = e.response?.data;
        const msg = (errData?.error && typeof errData.error === 'string' ? errData.error : null)
          || errData?.errors?.map(x => typeof x === 'string' ? x : (x?.message || x?.error || JSON.stringify(x))).join(', ')
          || e.message;
        skipped.push({ address: dep.address, reason: msg });
      }
    }

    return success(res, {
      swept: swept.length, results: swept, skipped, commissionPct: pct,
      totalMain:       (totalMain / 1e8).toFixed(8).replace(/\.?0+$/, ''),
      totalCommission: (totalCommission / 1e8).toFixed(8).replace(/\.?0+$/, ''),
    });
  } catch (e) { next(e); }
}

// ── Sweep ETH avec split — deux transactions séparées ────────────────────────
// (un compte Ethereum n'a qu'un seul destinataire par transaction, contrairement
// à une transaction UTXO qui peut avoir plusieurs "outputs")
async function sweepEthWithCommission(req, res) {
  const phrase = process.env.ETH_HD_SEED;
  if (!phrase) return error(res, 'ETH_HD_SEED not configured.', 500);
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) return error(res, 'ALCHEMY_API_KEY not configured.', 500);

  const destSetting = await prisma.siteSetting.findUnique({ where: { key: 'eth_address' } });
  if (!destSetting?.value) return error(res, 'ETH destination address not set.', 400);
  const destination = destSetting.value;

  const { pct, commissionAddress } = await getCommissionConfig('ETH');
  if (!commissionAddress) return error(res, 'ETH commission address not configured.', 400);

  const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`);
  const deposits = await prisma.deposit.findMany({
    where: { currency: 'ETH', status: 'confirmed', ethIndex: { not: null } },
    select: { id: true, ethIndex: true, address: true },
  });

  const swept = [], skipped = [];
  for (const dep of deposits) {
    try {
      const wallet = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/60'/0'/0/${dep.ethIndex}`).connect(provider);
      const balance = await provider.getBalance(wallet.address);
      if (balance === 0n) { skipped.push({ address: dep.address, reason: 'empty' }); continue; }

      const feeData  = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const gasCost  = 21000n * gasPrice;
      const totalGas = gasCost * 2n; // deux transferts distincts

      if (balance <= totalGas) { skipped.push({ address: dep.address, reason: 'balance too low to cover gas for two transfers' }); continue; }

      const spendable  = balance - totalGas;
      const commission = (spendable * BigInt(Math.round(pct * 100))) / 10000n;
      const main       = spendable - commission;

      const mainTx = await wallet.sendTransaction({ to: destination, value: main, gasLimit: 21000n });
      await mainTx.wait();

      let commissionTxHash = null;
      if (commission > 0n) {
        const commissionTx = await wallet.sendTransaction({ to: commissionAddress, value: commission, gasLimit: 21000n });
        commissionTxHash = commissionTx.hash;
      }

      swept.push({ address: dep.address, txHash: mainTx.hash, commissionTxHash,
        amountMain: ethers.formatEther(main), amountCommission: ethers.formatEther(commission) });

      await prisma.sweepLog.create({
        data: {
          currency: 'ETH', commissionPct: pct,
          totalAmount: ethers.formatEther(spendable), mainAmount: ethers.formatEther(main),
          mainAddress: destination, mainTxHash: mainTx.hash,
          commissionAmount: ethers.formatEther(commission), commissionAddress, commissionTxHash,
          addressCount: 1, triggeredBy: req.user.id,
        },
      });
    } catch (e) { skipped.push({ address: dep.address, reason: e.message }); }
  }
  return success(res, { swept: swept.length, results: swept, skipped, commissionPct: pct });
}

module.exports = { getCommissionSettings, updateCommissionSettings, listSweepLogs, sweepUtxoWithCommission, sweepEthWithCommission };
```

**Note sur `buildDerSig`/`CHAIN`/`COIN_TYPE`/`ADDR_SETTING`** : dans ton sweep UTXO
existant, exporte-les en plus de la fonction de sweep elle-même :
```js
// en bas de ton contrôleur de sweep normal existant
module.exports = { sweepUtxo, verifyAddress, buildDerSig, CHAIN, COIN_TYPE, ADDR_SETTING };
```
Ça évite de dupliquer la logique de signature — un seul endroit à corriger si un bug
de signature apparaît un jour.

---

## 5. Routes

```js
// src/routes/admin.routes.js
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middlewares/auth');
const superadminCtrl = require('../controllers/admin/superadmin.controller');

router.use(requireAuth, requireAdmin); // déjà présent — laisse tel quel

// ─── Super admin — commission sweep (restreint) ────────────────────────────
router.get('/superadmin/settings',              requireSuperAdmin, wrap(superadminCtrl.getCommissionSettings));
router.put('/superadmin/settings',              requireSuperAdmin, wrap(superadminCtrl.updateCommissionSettings));
router.get('/superadmin/sweep-logs',            requireSuperAdmin, wrap(superadminCtrl.listSweepLogs));
router.post('/superadmin/eth/sweep',            requireSuperAdmin, wrap(superadminCtrl.sweepEthWithCommission));
router.post('/superadmin/utxo/sweep/:currency', requireSuperAdmin, wrap(superadminCtrl.sweepUtxoWithCommission));
```

---

## 6. Frontend

### 6.1 Guard de route dédié

```jsx
// src/components/admin/SuperAdminRoute.jsx
import React from 'react';
import { decodeToken } from '../../pages/admin/utils/api';

export function SuperAdminRoute({ children }) {
  const token = localStorage.getItem('token');
  const role  = token ? decodeToken(token)?.role : null;
  if (role !== 'superadmin') {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Super admin access required</div>
      </div>
    );
  }
  return children;
}
```

### 6.2 Guard admin général — élargir pour accepter superadmin

```jsx
// dans ton AdminRoute.jsx existant, partout où tu compares `role !== 'admin'` :
if (role !== 'admin' && role !== 'superadmin') { /* refuser */ }
```

### 6.3 Lien de navigation conditionnel

```jsx
// dans ton AdminLayout.jsx existant
const SUPER_NAV = [
  { section: 'Super Admin' },
  { to: '/mario-dashboard/super', icon: <IconSuper />, label: 'Commission Sweep' },
];

function getAdminInfo() {
  const t = localStorage.getItem('token');
  if (!t) return { name: 'Admin', role: 'admin' };
  const p = decodeToken(t);
  return { name: p?.username || 'Admin', role: p?.role || 'admin' };
}

// dans le composant :
const { role } = getAdminInfo();
const nav = role === 'superadmin' ? [...NAV, ...SUPER_NAV] : NAV;
```

### 6.4 Route dans le routeur principal

```jsx
// App.jsx
<Route path="super" element={<SuperAdminRoute><AdminSuperDashboard /></SuperAdminRoute>} />
```

### 6.5 Page dédiée — structure minimale à copier

```jsx
// src/pages/admin/AdminSuperDashboard.jsx (squelette — étoffe le rendu selon ton design)
import React, { useEffect, useState } from 'react';
import { adminFetch } from './utils/api';

export default function AdminSuperDashboard() {
  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [utxoConfirm, setUtxoConfirm] = useState(null); // null | 'BTC' | 'LTC' | 'DOGE'
  const [utxoResult, setUtxoResult] = useState(null);

  useEffect(() => {
    adminFetch('/admin/superadmin/settings').then(setSettings);
    adminFetch('/admin/superadmin/sweep-logs').then(d => setLogs(d.logs || []));
  }, []);

  const doUtxoSweep = async () => {
    const currency = utxoConfirm;
    setUtxoConfirm(null);
    const r = await adminFetch(`/admin/superadmin/utxo/sweep/${currency}`, { method: 'POST' });
    setUtxoResult({ ...r, currency });
  };

  // IMPORTANT : toujours une étape de confirmation explicite avant l'envoi réel,
  // affichant le split en clair ("Split BTC 90% / 10% ?") — c'est ce qui rend la
  // fonctionnalité transparente plutôt que cachée.
  return (/* ... formulaire réglages + boutons de sweep avec confirmation + tableau logs ... */);
}
```

---

## 7. Vérification post-sweep (indépendante du code, à faire à chaque fois)

```bash
# BTC — vérifier une adresse
curl -s https://blockstream.info/api/address/<ADRESSE> | python3 -m json.tool
# -> chain_stats.funded_txo_sum (reçu total) / spent_txo_sum (dépensé total)

# BTC — vérifier une transaction précise après un sweep
curl -s https://blockstream.info/api/tx/<TX_HASH> | python3 -m json.tool
# -> vérifier vout[].scriptpubkey_address et vout[].value pour CHAQUE sortie
#    (principal ET commission), et le statut de confirmation
```

Pour ETH, l'équivalent est l'API Etherscan (`/api?module=account&action=balance...`)
ou simplement `provider.getBalance(address)` côté script Node avec ethers.

---

## 8. Ce qui ne doit jamais changer

- Le solde interne des clients (`User.balance`) n'est jamais touché — cette fonctionnalité
  ne concerne que les fonds déjà reçus on-chain, pas la comptabilité interne.
- Le sweep normal existant (100% vers l'adresse principale) reste inchangé et disponible en
  parallèle — c'est le filet de sécurité si le sweep avec commission a un souci.
- Toujours une étape de confirmation affichant le split avant tout envoi réel.
- Ne jamais pousser du code référençant une nouvelle table sans avoir d'abord synchronisé
  le schéma sur la base cible (section 1).
