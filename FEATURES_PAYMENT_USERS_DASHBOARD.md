# Analyse complète — Paiements, Gestion des Utilisateurs & Dashboard Admin
> Document de référence pour reproduire ces fonctionnalités dans un autre projet React + Express + PostgreSQL (Prisma).
> Chaque section indique le fichier source exact, les endpoints API, les champs de BDD et la logique métier.

---

## TABLE DES MATIÈRES
1. [Stack technique](#stack-technique)
2. [Authentification & Sessions](#authentification--sessions)
3. [Gestion des Utilisateurs (côté client)](#gestion-des-utilisateurs-côté-client)
4. [Gestion des Utilisateurs (côté admin)](#gestion-des-utilisateurs-côté-admin)
5. [Système de Paiement — Vue d'ensemble](#système-de-paiement--vue-densemble)
6. [Wallet utilisateur (dépôts de crédits)](#wallet-utilisateur-dépôts-de-crédits)
7. [Checkout — Paiement par solde interne](#checkout--paiement-par-solde-interne)
8. [Transactions](#transactions)
9. [Admin — Gestion des Dépôts](#admin--gestion-des-dépôts)
10. [Admin — Gestion des Transactions](#admin--gestion-des-transactions)
11. [Dashboard Admin — Vue principale](#dashboard-admin--vue-principale)
12. [Dashboard Admin — Analytics](#dashboard-admin--analytics)
13. [Dashboard Admin — Settings](#dashboard-admin--settings)
14. [Dashboard Admin — Layout & Navigation](#dashboard-admin--layout--navigation)
15. [Variables d'environnement](#variables-denvironnement)
16. [Endpoints API complets](#endpoints-api-complets)
17. [Schéma de base de données (entités clés)](#schéma-de-base-de-données-entités-clés)
18. [Dépendances npm clés](#dépendances-npm-clés)

---

## Stack Technique

| Couche     | Technologie                                              |
|------------|----------------------------------------------------------|
| Frontend   | React 18, React Router v6, Recharts, qrcode.react        |
| Backend    | Node.js + Express, express-async-errors, Prisma ORM      |
| Base de données | PostgreSQL                                          |
| Auth       | JWT (accessToken 15min) + refreshToken (localStorage)    |
| Crypto     | BlockCypher API (BTC/LTC/DOGE), Alchemy SDK (ETH), ethers.js HDNodeWallet |
| Images     | Cloudinary ou CDN local                                  |
| Emails     | SMTP (optionnel, non utilisé pour notifications)         |
| Notifications | Telegram QR code (pas d'email)                        |

**Convention API** : Toutes les réponses suivent l'enveloppe `{ success: true, data: {...} }` ou `{ success: false, error: "message" }`.

**Authentification admin** : Header `Authorization: Bearer <token>` — middleware `requireAuth` + `requireAdmin` sur toutes les routes `/api/admin/*`.

---

## Authentification & Sessions

### Fichiers sources
- `backend/src/controllers/auth.controller.js`
- `backend/src/services/auth.service.js`
- `frontend/src/context/AppContext.jsx`
- `frontend/src/utils/api.js`
- `frontend/src/pages/LoginPage.jsx`

### Endpoints
```
POST /api/auth/register   → crée un compte (username + password)
POST /api/auth/login      → retourne accessToken + refreshToken
POST /api/auth/refresh    → renouvelle l'accessToken depuis le refreshToken
POST /api/auth/logout     → logout côté serveur (stateless, vide le LS côté client)
```

### Flux de login
1. Formulaire : `username` + `password` (min 6 chars) + champ optionnel 2FA (prévu mais non implémenté côté backend actuellement)
2. POST `/api/auth/login` → vérifie `isActive`, compare hash bcrypt
3. Répons : `{ token, refreshToken, user: { id, username, role, balance, points } }`
4. Stockage : `localStorage.setItem('token', ...)` + `localStorage.setItem('refreshToken', ...)`
5. Ensuite `loadUserData()` est appelé : charge `/profile`, `/wallet`, `/categories`, `/content/settings` en parallèle (Promise.all)
6. Redirection vers `location.state?.from?.pathname || '/'`

### Renouvellement automatique du token
Le helper `api.js` intercepte les réponses HTTP 401 :
```js
// Si le user avait un token (hadToken=true) → tente le refresh
// Si le refresh échoue → logout() → redirect /login
```
L'accessToken expire en **15 minutes**. Le refreshToken n'expire pas côté serveur (JWT signé avec `JWT_REFRESH_SECRET`).

### Tokens JWT
```js
// Access token (15min)
jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' })
// Refresh token (pas d'expiration définie dans le code actuel)
jwt.sign({ sub: user.id }, JWT_REFRESH_SECRET)
```

### Page Login (`LoginPage.jsx`)
- AgeGate modal affiché en overlay avant le formulaire (mémorisé dans `localStorage.age_verified`)
- Si token déjà présent → `<Navigate to={from} replace />`
- Bouton "Use Recovery Code" pour basculer entre 2FA token et code de récupération (UI prête, backend à implémenter)
- Show/hide password (SVG eye icon)

### Inscription
- POST `/api/auth/register` : `{ username, password }`
- Crée 3 notifications de bienvenue automatiquement
- Pas d'email de confirmation

### AppContext — État global auth
```js
const { user, balance, login, logout, loadUserData, loadingAuth } = useApp();
// user = { id, username, role, bio, telegramHandle, signalDetails, sessionDetails, btcRefundAddress, xmrRefundAddress, ... }
// balance = number (USD)
// loadingAuth = true pendant la vérification initiale du token
```

---

## Gestion des Utilisateurs (côté client)

### Profil utilisateur
**Fichier** : `frontend/src/pages/ProfilePage.jsx`

Sections affichées (lecture seule avec bouton Edit pour chaque bloc) :
1. **Private details** — Username + Markup %
2. **Signal details** — numéro/handle Signal
3. **Session details** — identifiant Session messenger
4. **BTC Refund** — adresse Bitcoin pour remboursements
5. **XMR Refund** — adresse Monero pour remboursements
6. **Telegram Details** — handle Telegram + bouton "Auto-Link Account"

> **Note** : Le site ne collecte pas d'email. L'identification se fait par username uniquement.

### Wallet / Crédits
**Fichier** : `frontend/src/pages/WalletPage.jsx`

3 onglets :
- **Credit Deposits** : historique des dépôts crypto avec colonnes Id / Status / Currency / Address / Created / Details
- **Credit History** : transactions (type, montant +/-, date, note)
- **Legacy Credit History** : vide (placeholder)

---

## Gestion des Utilisateurs (côté admin)

### Liste des utilisateurs
**Fichier** : `frontend/src/pages/admin/AdminUsers.jsx`  
**Endpoint** : `GET /api/admin/users?page=1&limit=20&search=…&tier=…`

Colonnes tableau :
| Colonne  | Description                                     |
|----------|-------------------------------------------------|
| User     | Avatar initiale + username                      |
| Role     | customer / moderator / admin                    |
| Tier     | basic / preferred / gold / platinum (StatusBadge) |
| Balance  | Solde USD formaté                               |
| Orders   | Nombre de commandes (`_count.orders`)           |
| Joined   | Date d'inscription                              |
| Actions  | Bouton "View" → detail page                     |

Filtres :
- SearchInput (recherche par username, insensible à la casse)
- Select "All tiers" | basic | preferred | gold | platinum

**Bouton "+ Create User"** → modal avec : username, password, role (customer/moderator/admin)  
Endpoint : `POST /api/admin/users` → `{ username, password, role }`

**Tiers basés sur `totalSpent`** (calculé côté backend) :
```
basic     : $0–$999
preferred : $1000–$1999
gold      : $2000–$4999
platinum  : $5000+
```

**Cashback par tier** (wallet.service.js) :
```
basic     : 0.5%
preferred : 1.0%
gold      : 1.3%
platinum  : 1.5%
```

### Détail d'un utilisateur
**Fichier** : `frontend/src/pages/admin/AdminUserDetail.jsx`  
**Endpoint** : `GET /api/admin/users/:id`

6 onglets :

#### Onglet Profile
2 cards côte à côte :
- **Account Info** : id, username, role, status (Active/Banned), tier, markupPct, points, totalSpent, balance, joined, lastLogin
- **Contact & Details** : telegramHandle, signalDetails, sessionDetails, btcRefundAddress, xmrRefundAddress, bio

#### Onglet Orders
Tableau : Order# / Total / Status / Date  
Clique sur une ligne → `/mario-dashboard/orders/:id`  
Données : 5 dernières commandes (`recentOrders`)

#### Onglet Transactions
Tableau : Type (StatusBadge) / Amount (vert si +, rouge si -) / Note / Date  
Données : 5 dernières transactions (`recentTransactions`)

#### Onglet Deposits
Tableau : Currency / USD Credited / Status / Date  
Données : 5 derniers dépôts (`recentDeposits`)

#### Onglet Tickets
Tableau : Subject / Status / Priority / Date  
Clique → `/mario-dashboard/support/:id`  
Données : 3 derniers tickets (`recentTickets`)

#### Onglet API Keys
Tableau : Label / Prefix… / Last Used / Active / Created  
Données : toutes les clés API du user (`apiKeys`)

### Actions disponibles sur un utilisateur

#### Ban / Unban
```
PATCH /api/admin/users/:id/ban
```
Toggle `isActive` (false = banni). Bouton rouge si actif, vert si banni.

#### Set Password (modal)
```
PATCH /api/admin/users/:id/password
Body: { password: "..." }  (min 6 chars)
```
Champ avec show/hide. Confirmation 2e champ. Message de succès 1.5s puis fermeture auto.

#### Edit User (modal)
```
PUT /api/admin/users/:id
Body: { username, role, isActive }
```
Champs : username (required), role (select), status (Active/Banned select).

#### Adjust Balance (modal)
```
POST /api/admin/users/:id/wallet/adjust
Body: { type: "credit"|"debit", amount: float, reason: string }
```
- `credit` : incrémente le solde + crée une transaction `adjustment` avec montant positif
- `debit` : décrémente le solde + crée une transaction `adjustment` avec montant négatif
- Vérifie que le solde est suffisant pour un débit
- `reason` obligatoire (string)

**Le résultat est immédiat** : la page recharge les données (`load()` appelé après succès).

---

## Système de Paiement — Vue d'ensemble

### Principe fondamental
Il n'y a **pas** de paiement en temps réel lors de la commande. Le modèle est :

1. L'utilisateur **recharge son solde interne** (crédits USD) via des dépôts crypto.
2. Lors du **checkout**, le montant est débité du solde interne.
3. Le checkout affiche une option de "Payment Method" mais c'est en réalité la méthode utilisée pour le dépôt initial, **pas un paiement direct**.

### Devises acceptées pour les dépôts
| Crypto | Mécanisme        | Confirmation | Temps     |
|--------|-----------------|--------------|-----------|
| BTC    | BlockCypher API  | Automatique  | 10–60 min |
| LTC    | BlockCypher API  | Automatique  | 5–30 min  |
| DOGE   | BlockCypher API  | Automatique  | 5–15 min  |
| ETH    | Alchemy webhook  | Automatique  | 1–5 min   |
| XMR    | Manuel           | Manuel (24h) | < 24h     |

### Méthodes affichées au checkout
XMR · BTC · DOGE · LTC (radio buttons). Ce champ est stocké comme `paymentMethod` sur la commande — informatif uniquement.

---

## Wallet Utilisateur (Dépôts de Crédits)

### Fichiers sources
- `frontend/src/pages/WalletPage.jsx`
- `backend/src/controllers/wallet.controller.js`
- `backend/src/services/wallet.service.js`
- `backend/src/services/crypto.service.js`

### Endpoints wallet
```
GET  /api/wallet           → { balance, points, totalSpent, tier, cashback, remaining, daysLeft }
GET  /api/wallet/balance   → { balance }
GET  /api/wallet/deposits  → { deposits: [...], pagination }
GET  /api/wallet/deposits/:id
POST /api/wallet/deposit   → { currency: "BTC"|"LTC"|"DOGE"|"ETH"|"XMR" }
GET  /api/wallet/transactions → { transactions: [...], pagination }
```

### Flux de création d'un dépôt (étape par étape)

#### Étape 1 — Modal "Add Funds"
1. User clique "Add Funds"
2. Modal Step 1 s'ouvre (`modalStep = 'select'`)
3. Sélection de la crypto (BTC/LTC/DOGE/ETH/XMR) avec badges colorés
4. Affichage des terms and conditions (liste de 10 clauses)
5. Checkbox "I have read and agree to the deposit terms" (obligatoire)
6. Clic "Generate Address" → POST `/api/wallet/deposit`

#### Étape 2 — Modal avec adresse + QR
1. `modalStep = 'address'` → Modal Step 2 s'ouvre
2. Affichage :
   - QR code (`qrcode.react` `QRCodeSVG`, taille 180px)
   - URI scheme : `bitcoin:ADDR`, `litecoin:ADDR`, `dogecoin:ADDR`, `ethereum:ADDR`, `monero:ADDR`
   - Adresse en `<code>` + bouton copier (clipboard API)
   - Countdown timer (HH:MM:SS) jusqu'à `expiresAt` (mis à jour toutes les secondes via `setInterval`)
   - Guide "How it works" avec badge vert `⚡ Auto-confirmed` ou orange `👤 Manual review`
   - Steps numérotés spécifiques à chaque crypto
   - Warning coloré (vert si auto, rouge si manuel)
   - Pour XMR : bouton lien vers `/support`

### Logique backend de génération d'adresse (`crypto.service.js`)

#### BTC / LTC / DOGE (BlockCypher)
```js
// 1. Récupère l'adresse destination depuis admin settings (btc_address / ltc_address / doge_address)
// 2. POST https://api.blockcypher.com/v1/{chain}/forwards?token=TOKEN
//    Body: { destination, callback_url: "https://your-domain/api/webhooks/blockcypher" }
// 3. Retourne input_address (adresse unique pour ce dépôt) + hookId
// Les fonds reçus sur input_address sont auto-forwardés à destination
```

#### ETH (Alchemy + HD Wallet)
```js
// 1. Dérive une adresse ETH unique depuis la seed phrase (BIP44)
//    HDNodeWallet.fromPhrase(ETH_HD_SEED, undefined, `m/44'/60'/0'/0/${depositId}`)
// 2. Enregistre cette adresse dans le webhook Alchemy
//    PATCH https://dashboard.alchemy.com/api/update-webhook-addresses
// 3. Alchemy notifie quand des fonds arrivent sur cette adresse
```

#### XMR (Manuel)
```js
// Retourne l'adresse XMR globale stockée dans admin settings (xmr_address)
// TOUTES les transactions XMR vont à la même adresse
// L'user doit ouvrir un ticket support avec son TX Hash
// L'admin confirme manuellement
```

### Données de la table `Deposit`
| Champ           | Type      | Description                                         |
|-----------------|-----------|-----------------------------------------------------|
| id              | int       | PK                                                  |
| userId          | int       | FK → User                                           |
| currency        | string    | BTC / LTC / DOGE / ETH / XMR                       |
| address         | string    | Adresse de dépôt (ou 'pending' pendant création)    |
| status          | string    | awaiting / partial / confirmed / expired            |
| amountExpected  | decimal?  | Montant crypto attendu                              |
| amountReceived  | decimal   | Montant crypto reçu                                 |
| usdCredited     | decimal   | USD crédité sur le compte                           |
| expiresAt       | datetime  | Date d'expiration (défaut: 12h configurables)       |
| confirmedAt     | datetime? | Date de confirmation                                |
| transactionId   | int?      | FK → Transaction créée lors de la confirmation     |
| hookId          | string?   | ID webhook BlockCypher (pour suppression ultérieure)|
| ethIndex        | int?      | Index HD wallet pour ETH (= depositId)              |
| createdAt       | datetime  |                                                     |

### Statuts de dépôt
```
awaiting  → adresse générée, en attente de réception
partial   → fonds partiellement reçus
confirmed → fonds confirmés, solde crédité
expired   → adresse expirée (après N heures sans paiement)
```

### Termes et conditions affichés (DEPOSIT_TERMS)
1. Age 21+ requis
2. Envoyer n'importe quel montant à l'adresse affichée
3. Crédit basé sur le taux de change au moment de la confirmation on-chain
4. Crédit en USD
5. Exemple : $50 en BTC = $50 de store credit
6. Annulation après 12h sans transaction
7. Ne pas réutiliser les adresses — 1 transaction seulement
8. Dépôts supplémentaires perdus définitivement
9. Ne pas envoyer vers une adresse annulée
10. Fonds vers adresse annulée perdus définitivement

---

## Checkout — Paiement par Solde Interne

### Fichier source
`frontend/src/pages/CheckoutPage.jsx`

### Endpoint
```
POST /api/orders
Body: {
  items: [{ productId, quantity }],
  shippingAddress: "123 Main St, City 10001",
  paymentMethod: "XMR"|"BTC"|"DOGE"|"LTC",
  name: string,
  email: string
}
```

### Flux complet
1. Vérification du solde avant soumission : `balance >= total`
2. Si insuffisant → message d'erreur rouge + lien `/wallet`
3. Formulaire en 2 sections :
   - **Delivery Information** : name, email, address, city, postal, country
   - **Payment Method** : radio buttons XMR / BTC / DOGE / LTC (icônes SVG inline)
4. `POST /api/orders` → backend :
   - Groupe les items du panier par productId
   - Débite `totalAmount` du solde utilisateur
   - Crée la commande + items
   - Retourne `{ order, newBalance }`
5. Succès → affiche écran de confirmation avec `order.id` (ou `order.orderId`)
6. `setCartItems([])` + `setBalance(data.newBalance)`

### Calcul du total
```js
subtotal = sum(item.price) // prix déjà formaté "$X.XX" → parseFloat
shippingFee = (freeThreshold > 0 && subtotal >= freeThreshold) ? 0 : shippingCost
total = subtotal + shippingFee
```
`shippingCost` et `shipping_free_threshold` viennent de `settings` (AppContext, chargé depuis `/api/content/settings`).

### Écran de confirmation
- Icône check verte (SVG 40x40)
- "Order Confirmed!"
- Numéro de commande
- Liens : "View Orders" + "Continue Shopping"

---

## Transactions

### Modèle Transaction (table `Transaction`)
| Champ       | Type    | Description                                          |
|-------------|---------|------------------------------------------------------|
| id          | int     | PK                                                   |
| frontendId  | string  | ID lisible généré par `formatTxnId(Date.now())`      |
| userId      | int     | FK → User                                            |
| type        | string  | deposit / purchase / refund / adjustment / bonus     |
| amount      | decimal | Positif = crédit, négatif = débit                    |
| currency    | string  | USD / BTC / DOGE / LTC / XMR / ETH                  |
| status      | string  | pending / confirmed / failed                         |
| note        | string? | Description lisible                                  |
| txHash      | string? | Hash blockchain (pour dépôts auto)                   |
| orderId     | int?    | FK → Order (pour type=purchase)                      |
| depositId   | int?    | FK → Deposit (pour type=deposit)                     |
| createdAt   | datetime|                                                      |

### Quand une transaction est créée
| Event               | Type       | Montant |
|---------------------|------------|---------|
| Dépôt confirmé      | deposit    | +USD    |
| Commande passée     | purchase   | -USD    |
| Remboursement       | refund     | +USD    |
| Ajustement admin    | adjustment | ±USD    |
| Bonus               | bonus      | +USD    |

---

## Admin — Gestion des Dépôts

### Fichier source
`frontend/src/pages/admin/AdminDeposits.jsx`

### Endpoint
```
GET  /api/admin/deposits?page=1&limit=20&status=…&currency=…
PATCH /api/admin/deposits/:id/confirm   → { usdAmount, note? }
PATCH /api/admin/deposits/:id/expire
```

### Tableau des dépôts
Colonnes : ID (8 chars) / User / Currency (badge coloré) / Address / Expected / Received / USD Credited / Status / Expires / Created / Actions

**Couleurs par crypto** :
```js
BTC:  bg rgba(247,147,26,.15) color #f7931a
ETH:  bg rgba(98,126,234,.15) color #627eea
DOGE: bg rgba(194,166,51,.15) color #c2a633
LTC:  bg rgba(52,93,157,.15)  color #345d9d
XMR:  bg rgba(255,102,0,.15)  color #ff6600
```

### Bandeau informatif (Process Reference Panel)
2 panels côte à côte :
- **Vert** "⚡ Auto-confirmed (BTC · LTC · DOGE · ETH)" : explication du flow webhook
- **Orange** "👤 Manual review required (XMR)" : checklist pour confirmer un dépôt XMR

### Actions par dépôt

#### Confirmer un dépôt (bouton vert "Confirm")
- Visible si status = `awaiting` ou `partial`
- Modal avec :
  - Pour XMR : encart orange "XMR manual confirmation checklist" (3 étapes)
  - Champ "USD Amount to Credit" (number, min 0.01)
  - Champ "Note" (optionnel)
  - Bouton "Confirm & Credit"
- Backend : crée une Transaction `deposit`, update Deposit → `confirmed`, incrémente le balance user

#### Expirer un dépôt (bouton rouge "Expire")
- Visible si status = `awaiting`
- ConfirmModal de confirmation (danger)
- Backend : update Deposit → `expired`

#### Voir l'adresse complète
- Clic sur l'adresse tronquée → modal avec adresse complète en `monospace`
- Bouton "Copy Address"

---

## Admin — Gestion des Transactions

### Fichier source
`frontend/src/pages/admin/AdminTransactions.jsx`

### Endpoint
```
GET /api/admin/transactions?page=1&limit=25&search=…&type=…&status=…&currency=…&dateFrom=…&dateTo=…
```

### Filtres disponibles
- **Search** (par username)
- **Type** : deposit / purchase / refund / adjustment / bonus
- **Status** : completed / pending / failed
- **Currency** : USD / BTC / DOGE / LTC / XMR
- **Date From / Date To** (inputs de type date)
- Bouton "✕ Clear" si au moins un filtre actif

### Colonnes du tableau
| Colonne    | Description                                          |
|------------|------------------------------------------------------|
| ID         | 8 premiers chars (monospace, gris)                   |
| User       | Username (bold)                                      |
| Type       | StatusBadge (deposit / purchase / refund / ...)      |
| Amount     | Vert si ≥ 0, rouge si < 0 (format $XX.XX)           |
| Currency   | Monospace gris                                       |
| Status     | StatusBadge (completed / pending / failed)           |
| Note       | Texte gris, max-width 160px                          |
| Related to | "Order #id" ou "Deposit #id" ou "—"                  |
| Date       | toLocaleString() (date + heure)                      |

---

## Dashboard Admin — Vue Principale

### Fichier source
`frontend/src/pages/admin/AdminDashboard.jsx`

### Endpoint
```
GET /api/admin/dashboard
```

### Réponse API (structure complète)
```json
{
  "stats": {
    "revenue":  { "today": 0, "thisWeek": 0, "thisMonth": 0, "total": 0 },
    "orders":   { "today": 0, "pending": 0, "shipped": 0, "total": 0 },
    "users":    { "total": 0, "newToday": 0, "active": 0 },
    "products": { "total": 0, "lowStock": 0, "outOfStock": 0 },
    "tickets":  { "open": 0, "urgent": 0 }
  },
  "charts": {
    "revenueChart":      [{ "date": "YYYY-MM-DD", "revenue": 0 }],  // 30 derniers jours
    "ordersStatusChart": { "processing": 0, "shipped": 0, "delivered": 0, "cancelled": 0 },
    "topProducts":       [{ "id", "name", "imageUrl", "totalSold", "totalRevenue" }],
    "newUsersChart":     [{ "date": "YYYY-MM-DD", "count": 0 }]  // 7 derniers jours
  },
  "recentOrders":           [{ "id", "orderNumber", "user": {"username"}, "total", "status", "placedAt" }],
  "lowStockProducts":       [{ "id", "name", "stock", "imageUrl" }],
  "recentUnassignedTickets":[{ "id", "frontendId", "subject", "category", "priority", "createdAt" }]
}
```

### Grille de StatCards (8 cartes)
| Label               | Icon     | Couleur  | Valeur                           | Sous-texte                |
|---------------------|----------|----------|----------------------------------|---------------------------|
| Total Revenue       | Dollar   | #4361ee  | `stats.revenue.total`            | `Today: $X`               |
| Total Orders        | Box      | #2196f3  | `stats.orders.total`             | `Today: N`                |
| Pending Orders      | Clock    | #ff9800  | `stats.orders.pending`           | —                         |
| Shipped Orders      | Truck    | #9c27b0  | `stats.orders.shipped`           | —                         |
| Total Users         | Users    | #43a047  | `stats.users.total`              | —                         |
| Products            | Bag      | #1a1a2e  | `stats.products.total`           | `Low stock: N`            |
| Open Tickets        | Ticket   | #e53935  | `stats.tickets.open`             | `Urgent: N`               |
| Revenue This Month  | Calendar | #4361ee  | `stats.revenue.thisMonth`        | —                         |

**Skeleton loading** : pendant le chargement, chaque valeur est remplacée par `<span class="admin-skel">` (animation grise).

### Charts (Recharts)

#### Row 1 — 2 colonnes
1. **Revenue — Last 30 Days** (`LineChart`)
   - Data : `charts.revenueChart` → `{ date, revenue }`
   - XAxis : `date.slice(5)` (MM-DD), YAxis : `$N`
   - Line : stroke `#4361ee`, strokeWidth 2, dot false
   - Tooltip : `$N.NN Revenue`

2. **Orders by Status** (`PieChart` donut)
   - Data : `Object.entries(ordersStatusChart)` → `[{ name, value }]`
   - innerRadius 55, outerRadius 85, paddingAngle 2
   - Couleurs : `processing=#2196f3, shipped=#ff9800, delivered=#43a047, cancelled=#e53935`
   - Legend + Tooltip

#### Row 2 — 2 colonnes
3. **Top 5 Products** (`BarChart` horizontal)
   - Data : `charts.topProducts` → `{ name, sold }` (ou `totalSold`)
   - Layout vertical, barSize 14, radius [0,4,4,0]
   - Fill `#4361ee`
   - Label tronqué à 14 chars

4. **New Users — Last 7 Days** (`BarChart` vertical)
   - Data : `charts.newUsersChart` → `{ date, count }`
   - barSize 22, radius [4,4,0,0], fill `#43a047`

### Tables en bas de page — 2 colonnes

#### Recent Orders
Colonnes : Order# (bold) / Customer (username) / Total ($) / Status (StatusBadge)  
10 dernières commandes

#### Low Stock Products
Colonnes : Product (name) / Stock  
Stock en orange si > 0, rouge si = 0  
5 produits avec stock le plus bas (0 < stock ≤ 10)

---

## Dashboard Admin — Analytics

### Fichier source
`frontend/src/pages/admin/AdminAnalytics.jsx`

### Endpoint
```
GET /api/admin/analytics?period=30d
Périodes : 7d | 30d | 90d | 1y
```

### Réponse API (structure complète)
```json
{
  "summary": {
    "revenue":       0,
    "orders":        0,
    "newUsers":      0,
    "avgOrderValue": 0,
    "totalDeposits": 0
  },
  "revenueChart":        [{ "date", "revenue" }],
  "ordersChart":         [{ "date", "count" }],
  "newUsersChart":       [{ "date", "count" }],
  "walletFlow":          [{ "date", "deposits", "purchases" }],
  "topProducts":         [{ "id", "name", "category", "revenue", "sold" }],
  "topCategories":       [{ "name", "revenue" }],
  "depositsByCurrency":  [{ "currency", "value" }],
  "ordersStatusChart":   { "processing": 0, "shipped": 0, "delivered": 0, "cancelled": 0, "refunded": 0 },
  "revenueByMethod":     [{ "method", "revenue" }]
}
```

### Sélecteur de période
4 boutons : 7 days | 30 days | 90 days | 1 year  
Style `admin-btn-primary` (actif) ou `admin-btn-secondary`  
Déclenche un nouvel appel API à chaque changement

### Summary Cards (5 cartes)
| Label           | Couleur   | Format    |
|-----------------|-----------|-----------|
| Revenue         | #4361ee   | $X ou $Xk |
| Orders          | #2196f3   | entier    |
| New Users       | #43a047   | entier    |
| Avg Order       | #ff9800   | $X ou $Xk |
| Deposits        | #9c27b0   | $X ou $Xk |

`fmtK(n)` : si n ≥ 1000 → `$X.Xk`, sinon `$X`

### Charts (8 graphiques)

#### Row 1 — Revenue + New Users (LineChart)
- CartesianGrid `strokeDasharray="3 3"` gris clair
- Revenue : stroke `#4361ee`, strokeWidth 2.5, activeDot r=4
- New Users : stroke `#43a047`

#### Row 2 — Orders by Status (Donut) + Revenue by Payment Method (Bar)
- Donut : innerRadius 60, outerRadius 90
- Bar revenue by method : barSize 24, radius [4,4,0,0], couleurs `CAT_COLORS[]` cycliques

#### Row 3 — Top 10 Products (Tableau)
Colonnes : # / Product (bold) / Category / Revenue (vert bold) / Units Sold

#### Row 4 — Revenue by Category (Bar horizontal) + Deposits by Currency (Donut)
- Category bar : layout vertical, barSize 16, radius [0,4,4,0]
- Deposits donut : innerRadius 50, outerRadius 80, couleurs crypto
- Couleurs dépôts : `{ BTC:#f7931a, ETH:#627eea, DOGE:#c2a633, LTC:#345d9d, XMR:#ff6600, USD:#4361ee }`

#### Row 5 — Wallet Flow (AreaChart)
- 2 aires superposées : deposits (vert) + purchases (rouge)
- `linearGradient` SVG pour effet dégradé transparent
- `gradDeposits` : #43a047, `gradPurchases` : #e53935

---

## Dashboard Admin — Settings

### Fichier source
`frontend/src/pages/admin/AdminSettings.jsx`

### Endpoints
```
GET /api/admin/settings        → { settings: { key: value, ... } }
PUT /api/admin/settings        → Body: { key: value, ... }
POST /api/admin/eth/sweep      → effectue le sweep ETH
```

### 5 onglets

#### Onglet General
| Clé setting         | Type     | Description                                              |
|---------------------|----------|----------------------------------------------------------|
| `site_name`         | string   | Nom du site                                              |
| `maintenance_mode`  | boolean  | Si true, le store est inaccessible aux clients           |
| `registration_open` | boolean  | Si false, les inscriptions sont désactivées              |

#### Onglet Shipping
| Clé setting                | Type   | Description                                         |
|----------------------------|--------|-----------------------------------------------------|
| `shipping_cost`            | float  | Coût de livraison ($)                               |
| `shipping_free_threshold`  | float  | Seuil pour livraison gratuite ($)                   |
| `shipping_deadline_h`      | int    | Heure limite commande same-day (heures)             |
| `shipping_deadline_m`      | int    | Heure limite commande same-day (minutes)            |

#### Onglet Loyalty
| Clé setting   | Type  | Description                            |
|---------------|-------|----------------------------------------|
| `points_rate` | float | Points par $1 dépensé (ex: 0.5)        |

Tableau read-only des tiers de fidélité :
```
Basic     : $0–$999    → 0% cashback
Preferred : $1000–$1999 → 1% cashback
Gold      : $2000–$4999 → 2.5% cashback
Platinum  : $5000+      → 5% cashback
```

#### Onglet Deposits
| Clé setting           | Type  | Description                                  |
|-----------------------|-------|----------------------------------------------|
| `deposit_expiry_hours`| int   | Durée de vie des adresses de dépôt (défaut 12h)|
| `min_deposit`         | float | Dépôt minimum ($)                            |
| `max_deposit`         | float | Dépôt maximum ($)                            |

#### Onglet Crypto — Adresses de destination
| Clé setting    | Crypto | Mécanisme                           |
|----------------|--------|-------------------------------------|
| `btc_address`  | BTC    | Auto-forwarded via BlockCypher      |
| `doge_address` | DOGE   | Auto-forwarded via BlockCypher      |
| `ltc_address`  | LTC    | Auto-forwarded via BlockCypher      |
| `eth_address`  | ETH    | Destination du sweep manuel         |
| `xmr_address`  | XMR    | Adresse unique partagée             |

**Important** : Ces adresses sont stockées en BDD (`SiteSetting`), **pas** dans les variables d'environnement (sauf XMR qui a un fallback env).

#### ETH Sweep
Bouton "Sweep ETH to my address" :
1. Confirmation inline (affiche l'adresse tronquée + bouton "Yes, sweep")
2. POST `/api/admin/eth/sweep`
3. Collecte tout l'ETH des adresses de dépôt confirmées
4. Affiche résultat : N address(es) swept + détails par adresse (amountEth, txHash tronqué)

**Logique sweep** : parcourt tous les deposits ETH `confirmed`, récupère le solde de chaque adresse HD wallet dérivée, signe et envoie la transaction vers `eth_address`.

---

## Dashboard Admin — Layout & Navigation

### Fichier source
`frontend/src/pages/admin/AdminLayout.jsx`

### URL de base
`/mario-dashboard` (à adapter selon votre projet)

### Structure HTML
```
.admin-layout
├── .admin-sidebar (aside)
│   ├── .admin-sidebar-logo (logo + "Admin Dashboard")
│   ├── nav.admin-nav
│   │   ├── .admin-nav-section (séparateurs)
│   │   └── NavLink.admin-nav-link (avec .active si sélectionné)
│   └── .admin-sidebar-footer (bouton Logout)
└── .admin-main
    ├── header.admin-header
    │   ├── Burger button (mobile)
    │   └── .admin-user-chip (avatar initiale + username)
    └── .admin-content
        └── <Outlet />
```

**Overlay mobile** : `.admin-sidebar-overlay` (div cliquable pour fermer le sidebar sur mobile).

### Navigation complète
```
── Overview ──────────────────────────────
Dashboard         /mario-dashboard         (end=true)

── Commerce ──────────────────────────────
Orders            /mario-dashboard/orders
Products          /mario-dashboard/products
Categories        /mario-dashboard/categories
Brands            /mario-dashboard/brands

── Users & Finance ───────────────────────
Users             /mario-dashboard/users
Deposits          /mario-dashboard/deposits
Transactions      /mario-dashboard/transactions

── Support ───────────────────────────────
Support Tickets   /mario-dashboard/support
Reviews           /mario-dashboard/reviews

── Content ───────────────────────────────
News              /mario-dashboard/news
FAQ               /mario-dashboard/faq
Giveaways         /mario-dashboard/giveaways

── System ────────────────────────────────
Analytics         /mario-dashboard/analytics
System Status     /mario-dashboard/system-status
Settings          /mario-dashboard/settings
```

### Icônes
Toutes les icônes sont des SVG inline (pas de lib externe) :
- Dashboard : 4 rectangles (grille)
- Orders : clipboard
- Products : sac shopping
- Categories : tag
- Brands : bookmark
- Users : silhouette groupe
- Deposits : carte bancaire
- Transactions : symbole dollar
- Support : bulle chat
- Reviews : étoile
- News : document
- FAQ : cercle point d'interrogation
- Giveaways : cadeau
- Analytics : graphe montant
- System Status : cercles concentriques (onde)
- Settings : engrenage
- Logout : porte de sortie

### Récupération du nom admin
Décodage du JWT en localStorage (without lib) :
```js
const payload = token.split('.')[1];
JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
// → { sub, role, username }
```

### Middleware de protection
```js
// backend/src/middlewares/auth.js
requireAuth  → vérifie Bearer token JWT
requireAdmin → vérifie role === 'admin' (ou 'moderator' selon les besoins)
```

### adminFetch helper
```js
// frontend/src/pages/admin/utils/api.js
async function adminFetch(endpoint, options = {}) {
  // Injecte automatiquement Authorization: Bearer <token>
  // Unwrap { success, data } envelope
  // Lance Error si success=false
}
```

---

## Variables d'Environnement

```env
# Core
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
FRONTEND_URL=http://localhost:3000

# Auth
JWT_SECRET=change_me_jwt_secret
JWT_REFRESH_SECRET=change_me_refresh_secret

# Upload / CDN
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880          # 5MB
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CDN_BASE_URL=https://your-cdn.com

# Public URL (pour les webhooks entrants BlockCypher)
RAILWAY_PUBLIC_URL=https://your-backend-domain.com

# Crypto — BlockCypher (BTC/LTC/DOGE auto-forward)
BLOCKCYPHER_TOKEN=your_token

# Crypto — Alchemy (ETH webhooks)
ALCHEMY_API_KEY=
ALCHEMY_SIGNING_KEY=            # pour vérifier les webhooks Alchemy
ALCHEMY_AUTH_TOKEN=             # pour enregistrer des adresses dans le webhook
ALCHEMY_WEBHOOK_ID=

# Crypto — ETH HD Wallet (génère une adresse unique par dépôt)
ETH_HD_SEED=your 12 word seed phrase here

# Note : les adresses BTC/LTC/DOGE/XMR/ETH destination sont dans Admin → Settings → Crypto
```

---

## Endpoints API Complets

### Auth
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
```

### Wallet (authentifié)
```
GET  /api/wallet                    → balance + tier info
GET  /api/wallet/balance
GET  /api/wallet/deposits           → liste dépôts user
GET  /api/wallet/deposits/:id
POST /api/wallet/deposit            → { currency }
GET  /api/wallet/transactions
```

### Commandes (authentifié)
```
GET  /api/orders
POST /api/orders                    → { items, shippingAddress, paymentMethod, name, email }
GET  /api/orders/:id
```

### Profil (authentifié)
```
GET  /api/profile
PUT  /api/profile
```

### Admin (requireAuth + requireAdmin)
```
// Dashboard
GET  /api/admin/dashboard

// Users
GET  /api/admin/users?page&limit&search&tier&role&isActive&sortBy&sortOrder
POST /api/admin/users              → { username, password, role }
GET  /api/admin/users/:id
PUT  /api/admin/users/:id          → { username, role, isActive, markupPct }
PATCH /api/admin/users/:id/ban
PATCH /api/admin/users/:id/password → { password }
POST /api/admin/users/:id/wallet/adjust → { type, amount, reason }

// Deposits
GET  /api/admin/deposits?page&limit&status&currency
PATCH /api/admin/deposits/:id/confirm → { usdAmount, note? }
PATCH /api/admin/deposits/:id/expire

// Transactions
GET  /api/admin/transactions?page&limit&search&type&status&currency&dateFrom&dateTo

// Orders
GET  /api/admin/orders?page&limit&search&status&paymentMethod
PATCH /api/admin/orders/:id/status   → { status }
PATCH /api/admin/orders/:id/tracking → { trackingNumber, carrier }

// Analytics
GET  /api/admin/analytics?period=7d|30d|90d|1y

// Settings
GET  /api/admin/settings
PUT  /api/admin/settings            → { key: value, ... }

// ETH Sweep
POST /api/admin/eth/sweep

// System Status
GET  /api/admin/system-status
PUT  /api/admin/system-status/:id

// Webhooks (depuis BlockCypher/Alchemy)
POST /api/webhooks/blockcypher
POST /api/webhooks/alchemy
```

---

## Schéma de Base de Données (Entités Clés)

### User
```prisma
model User {
  id                Int       @id @default(autoincrement())
  username          String    @unique
  passwordHash      String
  role              String    @default("customer")  // customer | moderator | admin
  isActive          Boolean   @default(true)
  balance           Decimal   @default(0)           // solde USD
  points            Int       @default(0)           // points de fidélité
  totalSpent        Decimal   @default(0)           // total dépensé (pour calcul tier)
  markupPct         Decimal   @default(0)           // majoration prix affichés
  bio               String?
  telegramHandle    String?
  signalDetails     String?
  sessionDetails    String?
  btcRefundAddress  String?
  xmrRefundAddress  String?
  hidePrices        Boolean   @default(false)
  notifOrders       Boolean   @default(true)
  notifDeposits     Boolean   @default(true)
  notifTickets      Boolean   @default(true)
  notifNewProducts  Boolean   @default(true)
  notifLogins       Boolean   @default(true)
  tourCompleted     Boolean   @default(false)
  avatarUrl         String?
  lastLoginAt       DateTime?
  createdAt         DateTime  @default(now())
  orders            Order[]
  transactions      Transaction[]
  deposits          Deposit[]
  supportTickets    SupportTicket[]
  apiKeys           ApiKey[]
  notifications     Notification[]
}
```

### Deposit
```prisma
model Deposit {
  id             Int       @id @default(autoincrement())
  userId         Int
  user           User      @relation(fields: [userId], references: [id])
  currency       String    // BTC | LTC | DOGE | ETH | XMR
  address        String
  status         String    @default("awaiting")  // awaiting | partial | confirmed | expired
  amountExpected Decimal?
  amountReceived Decimal   @default(0)
  usdCredited    Decimal   @default(0)
  expiresAt      DateTime
  confirmedAt    DateTime?
  hookId         String?   // BlockCypher forwarding ID
  ethIndex       Int?      // HD wallet index pour ETH
  transactionId  Int?      // FK → Transaction
  transaction    Transaction? @relation(...)
  createdAt      DateTime  @default(now())
}
```

### Transaction
```prisma
model Transaction {
  id         Int      @id @default(autoincrement())
  frontendId String
  userId     Int
  user       User     @relation(...)
  type       String   // deposit | purchase | refund | adjustment | bonus
  amount     Decimal  // positif = crédit, négatif = débit
  currency   String   @default("USD")
  status     String   @default("confirmed")  // pending | confirmed | failed
  note       String?
  txHash     String?  // hash blockchain
  orderId    Int?
  depositId  Int?
  createdAt  DateTime @default(now())
}
```

### SiteSetting
```prisma
model SiteSetting {
  key   String @id
  value String
}
// Clés utilisées : site_name, maintenance_mode, registration_open,
// shipping_cost, shipping_free_threshold, shipping_deadline_h, shipping_deadline_m,
// points_rate, deposit_expiry_hours, min_deposit, max_deposit,
// btc_address, ltc_address, doge_address, eth_address, xmr_address
```

### ApiKey
```prisma
model ApiKey {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(...)
  keyPrefix String   // premiers chars de la clé (affichage)
  keyHash   String   // hash de la clé complète
  label     String?
  isActive  Boolean  @default(true)
  lastUsed  DateTime?
  createdAt DateTime @default(now())
}
```

---

## Dépendances npm Clés

### Frontend
```json
{
  "react": "^18.x",
  "react-router-dom": "^6.x",
  "recharts": "^2.x",
  "qrcode.react": "^3.x"
}
```

### Backend
```json
{
  "express": "^4.x",
  "express-async-errors": "^3.x",
  "@prisma/client": "^5.x",
  "prisma": "^5.x",
  "jsonwebtoken": "^9.x",
  "bcrypt": "^5.x",
  "axios": "^1.x",
  "ethers": "^6.x",
  "dotenv": "^16.x",
  "multer": "^1.x"
}
```

---

## Notes importantes pour la reproduction

### Pattern de réponse API uniforme
Tous les endpoints retournent exactement :
```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": "message" }
```
Le helper frontend `api.js` unwrap automatiquement `data` et throw si `success=false`.

### StatusBadge — composant réutilisable
`frontend/src/components/admin/StatusBadge.jsx` gère les couleurs pour :
- Statuts commandes : processing (bleu), shipped (violet), delivered (vert), cancelled (rouge)
- Statuts dépôts : awaiting (orange), confirmed (vert), expired (gris), partial (jaune)
- Tiers user : basic (gris), preferred (bleu), gold (orange), platinum (violet)
- Rôles : customer, moderator, admin
- Types de transaction : deposit, purchase, refund, adjustment, bonus

### Skeleton loading
Pattern utilisé partout en admin : pendant le chargement, les cellules affichent `<span class="admin-skel">` (CSS animation pulse grise). Classe : `admin-skel` à définir en CSS.

### Pagination
Composant `Pagination.jsx` réutilisable : reçoit `page`, `totalPages`, `onChange`.  
Backend : `parsePaginationParams(req.query)` + `buildPagination(page, limit, total)`.

### Admin CSS
Tout le CSS admin est dans `admin.css` importé dans `AdminLayout.jsx`.  
Classes principales :
```
.admin-layout, .admin-sidebar, .admin-main, .admin-content, .admin-header
.admin-nav, .admin-nav-link, .admin-nav-link.active, .admin-nav-section
.admin-page-header, .admin-page-title, .admin-page-subtitle
.admin-stat-grid, .admin-stat-card
.admin-chart-wrap, .admin-chart-title
.admin-card, .admin-card-title
.admin-table-wrap, .admin-table, .admin-table-empty
.admin-filters, .admin-filter-select, .admin-filter-input
.admin-tabs, .admin-tab, .admin-tab.active
.admin-modal-overlay, .admin-modal, .admin-modal-title, .admin-modal-actions
.admin-btn, .admin-btn-primary, .admin-btn-secondary, .admin-btn-success, .admin-btn-danger, .admin-btn-sm
.admin-input, .admin-select, .admin-label, .admin-form-group
.admin-avatar (cercle avec initiale), .admin-badge
.admin-info-list, .admin-info-row, .admin-info-label, .admin-info-value
.admin-skel (animation skeleton)
```

---

## User Stories — Flux Complets

### US-1 : Recharger son solde (Dépôt crypto)

```
En tant qu'utilisateur connecté,
je veux déposer des cryptos pour obtenir du solde USD,
afin de pouvoir passer des commandes.

Flux :
1. Accéder à /wallet → onglet "Credit Deposits"
2. Cliquer "Add Funds" → Modal Step 1 s'ouvre
3. Choisir la crypto (BTC / LTC / DOGE / ETH / XMR)
4. Cocher la case de consentement aux CGU
5. Cliquer "Generate Address" → POST /api/wallet/deposit
6. Modal Step 2 : QR code + adresse + timer (12h par défaut)
7. Envoyer les cryptos depuis son wallet externe
8. Webhook reçu → USD crédité automatiquement (BTC/LTC/DOGE/ETH)
   OU ouvrir un ticket support avec TX Hash (XMR)

Résultat : balance += usdCredited, transaction type=deposit créée
```

### US-2 : Passer une commande (Checkout)

```
En tant qu'utilisateur avec un solde suffisant,
je veux acheter des produits en débitant mon solde interne,
afin de recevoir ma commande.

Préconditions : balance >= total du panier

Flux :
1. Ajouter produits au panier
2. Aller sur /checkout
3. Remplir "Delivery Information" (name, email, address, city, postal, country)
4. Choisir "Payment Method" (XMR/BTC/DOGE/LTC — informatif uniquement)
5. Vérification solde : si balance < total → erreur rouge + lien /wallet
6. Cliquer "Place Order" → POST /api/orders
7. Backend : débite balance, crée Order + OrderItems + Transaction(purchase)
8. Écran de confirmation avec order.id
9. Panier vidé, balance mise à jour

Résultat : balance -= total, order.status = "processing"
```

### US-3 : Ouvrir un ticket support

```
En tant qu'utilisateur (connecté ou non),
je veux soumettre un problème à l'équipe support,
afin d'obtenir de l'aide.

Via SupportPage (/support) :
1. Cliquer "Get Support"
2. Choisir catégorie (General / Order Issue / Payment / etc.)
3. Saisir Subject (requis) + Message (min 10 chars)
4. Cliquer "Submit Ticket" → POST /api/support/tickets
5. Ticket créé, visible dans la liste avec status = "open"

Via SupportWidget (FAB sur toutes les pages) :
1. Cliquer le bouton flottant vert
2. Choisir "Ask Support" ou "Community Chat"
3. Ask Support : sélectionner une situation parmi 9 choix
4. Préciser si lié à "Order", "Deposit" ou "Not related"
5. Saisir le premier message dans le chat drawer
6. Premier envoi → POST /api/support/tickets automatiquement
7. Réponse automatique : "a support agent will reply shortly"

Résultat : SupportTicket créé + SupportMessage créé
```

### US-4 : Admin confirme un dépôt XMR

```
En tant qu'admin,
je veux confirmer manuellement un dépôt XMR après vérification,
afin de créditer le compte de l'utilisateur.

Flux :
1. Aller sur /mario-dashboard/deposits
2. Trouver le dépôt XMR (status = awaiting)
3. Cliquer "Confirm"
4. Checklist XMR : vérifier TX hash sur blockchain Monero
5. Saisir le montant USD à créditer
6. Cliquer "Confirm & Credit"
   → PATCH /api/admin/deposits/:id/confirm { usdAmount }
7. Backend : Transaction(deposit) créée, Deposit.status = confirmed,
   User.balance += usdAmount

Résultat : balance utilisateur incrémentée
```

### US-5 : Admin gère un ticket support

```
En tant qu'admin,
je veux répondre à un ticket et changer son statut,
afin d'assurer le suivi des demandes.

Flux :
1. Aller sur /mario-dashboard/support
2. Filtrer par status/priority, rechercher par subject
3. Cliquer sur un ticket → AdminTicketDetail
4. Lire la conversation (messages utilisateur + staff)
5. Changer Status (open/in_progress/resolved/closed) et/ou Priority
6. Cliquer "Update"
   → PATCH /api/admin/support/tickets/:id/status { status }
   → PATCH /api/admin/support/tickets/:id/priority { priority }
7. Saisir une réponse (optionnellement cocher "Internal note")
8. Cliquer "Send Reply"
   → POST /api/admin/support/tickets/:id/messages { message, isInternal }
9. Si isInternal=false → Deposit.response = "responded"

Résultat : ticket mis à jour, message staff créé
```

### US-6 : Sweep ETH

```
En tant qu'admin,
je veux collecter tous les ETH reçus vers mon adresse destination,
afin de centraliser les fonds.

Préconditions : ETH_HD_SEED + ALCHEMY_API_KEY configurés,
                eth_address configurée dans Settings → Crypto

Flux :
1. Aller sur /mario-dashboard/settings → onglet "Crypto"
2. Vérifier l'adresse ETH destination
3. Cliquer "Sweep ETH to my address"
4. Confirmer avec "Yes, sweep"
5. POST /api/admin/eth/sweep
6. Backend itère sur tous les Deposit ETH (status=confirmed)
7. Pour chaque adresse HD wallet avec solde > gas cost :
   - Calcule gas (21 000 × gasPrice)
   - Signe et envoie tx vers eth_address
8. Résultat : { swept: N, results: [...], skipped: [...] }

Chaque result : { address, txHash, amountEth }
Chaque skipped : { address, reason: "empty" | "balance too low..." | message }
```

---

## Support — Côté Utilisateur

### SupportPage (`/support`)

**Fichier** : `frontend/src/pages/SupportPage.jsx`

#### Structure UI
```
AccountSidebar (gauche)
└── account-main
    ├── .support-page-header
    │   ├── <h3> Support
    │   └── Button "Get Support" (toggle)
    ├── .support-form-card (affiché si showForm=true)
    │   └── <form>
    │       ├── Select category
    │       ├── Input subject *
    │       ├── Textarea message *
    │       └── Button "Submit Ticket"
    └── .support-tickets-card
        └── .credits-table-wrap
            └── Table : Type | Support ticket # | Status | Response | Created
```

#### Catégories disponibles
```js
const CATEGORIES = [
  'General', 'Order Issue', 'Payment', 'Shipping',
  'Product Question', 'Account', 'Technical', 'Other'
];
```

#### Validation côté frontend
- `subject` : requis (non vide)
- `message` : min 10 caractères (sinon erreur "Please provide more detail")

#### Validation côté backend (Zod)
```js
z.object({
  category: z.enum(['General','Order Issue','Payment','Shipping',
                    'Product Question','Account','Technical','Other']),
  subject:  z.string().min(1),
  message:  z.string().min(10),
})
```

#### Tableau des tickets (colonnes)
| Colonne | Source données |
|---------|---------------|
| Type | `ticket.category` |
| Support ticket # | `ticket.id` |
| Status | `ticket.status` → badge `.credits-status-badge.open` |
| Response | `ticket.response` ou `ticket.adminResponse` → "Replied" / "Pending" |
| Created | `ticket.createdAt` formaté en `Mon DD, YYYY` |

#### Endpoints utilisés
```
GET  /api/support/tickets    → charge la liste des tickets du user
POST /api/support/tickets    → crée un nouveau ticket
     Body: { category, subject, message }
     Réponse: { ticket: { id, frontendId, category, status, response, createdAt, subject } }
```

#### Middleware auth : `optionalAuth`
Les tickets peuvent être soumis sans être connecté (userId sera null). Si connecté, userId est associé.

---

### SupportWidget (FAB flottant)

**Fichier** : `frontend/src/components/SupportWidget.jsx`

Bouton flottant rond positionné en bas à droite de toutes les pages du store (inclus dans Layout global).

#### Situations disponibles (9 + "Other")
```js
const SITUATIONS = [
  'Missing/Wrong Items', 'Delayed Package', 'Website Bug',
  'Cancelled Order', 'Emergency Contact', 'Website Feature Request',
  'Deposit Issue', 'Product Requests', 'Missing Product Image',
];
```

#### Sous-options (lien avec type)
```js
const SUB_OPTIONS = ['Order', 'Deposit', 'Not related'];
```

#### États (state machine)
```
null       → FAB visible, menu fermé
"open"     → menuBox visible (2 boutons : Community Chat / Ask Support)
"situations" → Modal centré sombre : grille de 9 situations
"sub"      → Modal centré : "Is this related to an order or deposit?"
"chat"     → Drawer latéral droit : conversation en temps réel
```

#### Flux création ticket automatique
- Premier message envoyé → `POST /api/support/tickets`
- Body : `{ subject: topic || 'Support request', category: situation || 'General', message: text }`
- Les messages suivants ne créent **pas** de nouveaux tickets (déjà créé)
- Réponse automatique agent après 900ms : "Thanks for reaching out — a support agent will reply here shortly."

#### Structure HTML du drawer chat
```
.supw-drawer
├── .supw-drawer-head (date + bouton fermer)
├── .supw-drawer-thread (messages scrollables)
│   ├── .supw-drawer-topic (titre du topic)
│   └── .supw-dmsg.supw-dmsg--me | .supw-dmsg.supw-dmsg--agent
│       ├── .supw-dbubble (texte)
│       └── .supw-dtime (heure HH:MM)
└── .supw-drawer-composer (form)
    ├── .supw-drawer-input (input texte)
    └── .supw-drawer-actions
        ├── .supw-emoji-btn (SmileIcon — décoratif)
        └── .supw-send-btn
```

---

### Endpoints Support (utilisateur)

```
GET   /api/support/tickets          → liste tickets du user connecté
POST  /api/support/tickets          → crée un ticket
      Body: { category, subject, message }
GET   /api/support/tickets/:id      → détail d'un ticket + messages (non-internes)
POST  /api/support/tickets/:id/messages → ajoute un message utilisateur
      Body: { message: string }
      Effet secondaire : ticket.response = "pending"
PATCH /api/support/tickets/:id/close → ferme le ticket
      Conditions : status doit être "open" ou "in_progress"
```

**Protection** : middleware `optionalAuth` (fonctionne avec ou sans token).
**Contrôle d'accès** : `checkOwnership(ticket, req)` — seul le créateur peut voir/modifier son ticket.

---

## Support — Côté Admin

### AdminSupport (`/mario-dashboard/support`)

**Fichier** : `frontend/src/pages/admin/AdminSupport.jsx`

#### Chargement parallèle
```js
// Au premier chargement uniquement : charge stats + liste
Promise.all([
  adminFetch('/admin/support?...'),
  adminFetch('/admin/support/stats'),
])
```

#### 4 StatCards (bandeau haut)
| Label | Couleur | Valeur |
|-------|---------|--------|
| Open | #2196f3 | `stats.open` |
| In Progress | #ff9800 | `stats.in_progress` |
| Resolved | #43a047 | `stats.resolved` |
| Closed | #6c757d | `stats.closed` |

#### Filtres
```
SearchInput       → recherche par subject (insensible à la casse)
Select "Status"   → open / in_progress / resolved / closed
Select "Priority" → urgent / high / normal / low
```

#### Tableau
Colonnes : **Subject** (bold, max-width 200px) / **User** (username) / **Status** (badge) / **Priority** (badge) / **Assignee** (username ou "—") / **Date** (toLocaleDateString) / **Bouton "Open"**

Clic sur une ligne → navigation vers `/mario-dashboard/support/:id`

#### Endpoint
```
GET /api/admin/support?page=1&limit=20&status=…&priority=…&search=…
Réponse: { tickets: [...], total, pagination }
Chaque ticket inclut : lastMessage (dernier message), user { id, username }
```

```
GET /api/admin/support/stats
Réponse: { open: N, in_progress: N, resolved: N, closed: N }
```

---

### AdminTicketDetail (`/mario-dashboard/support/:id`)

**Fichier** : `frontend/src/pages/admin/AdminTicketDetail.jsx`

#### Layout 2 colonnes

**Colonne gauche — Conversation**
```
.admin-thread (scrollable, auto-scroll vers le bas)
└── Pour chaque message :
    .admin-msg.staff ou .admin-msg.user (+ .internal si note interne)
    ├── .admin-msg-meta → auteur (Staff/username) + " · Internal" si interne
    ├── .admin-msg-body → texte du message
    └── .admin-msg-time → toLocaleString()

<form> Réponse admin :
├── <textarea> "Write a reply…"
├── Checkbox "Internal note" (isInternal)
└── Button "Send Reply"
```

**Colonne droite — Contrôles**

Card "Update Ticket" :
```
Select Status   : open | in_progress | resolved | closed
Select Priority : urgent | high | normal | low
Button "Update"
```

Card "Details" :
```
Category  : ticket.category
Assignee  : ticket.assignee?.username || "Unassigned"
Created   : toLocaleString()
Updated   : toLocaleString()
```

#### Endpoints admin pour un ticket
```
GET   /api/admin/support/:id
      Réponse: { ticket: { ...fields, messages: [...], user, assignee } }
      Note : messages filtrés à isInternal=false côté user,
             mais TOUS visibles côté admin

POST  /api/admin/support/:id/messages
      → /api/admin/support/tickets/:id/messages (route backend)
      Body: { message: string, isInternal: boolean }
      Si isInternal=false → ticket.response = "responded"
      Si isInternal=true  → note interne, pas de changement response

PATCH /api/admin/support/:id
      → Combine status + priority en un seul appel
      Body: { status, priority }
      (Note : le backend a des routes séparées pour status et priority)

Routes backend séparées :
PATCH /api/admin/support/tickets/:id/status   → { status }
PATCH /api/admin/support/tickets/:id/priority → { priority }
PATCH /api/admin/support/tickets/:id/assign   → { adminId }
```

#### Statuts et transitions valides
```
open       → in_progress | resolved | closed
in_progress → resolved | closed
resolved   → closed (ou ré-ouverture)
closed     → (terminal)

Priorités : urgent | high | normal | low
```

---

### Schéma BDD — Support

```prisma
model SupportTicket {
  id         Int      @id @default(autoincrement())
  frontendId String?  @unique   // généré par formatTicketId(Date.now())
  userId     Int?               // null si ticket anonyme
  category   String   @default("General")
  subject    String
  status     String   @default("open")     // open | in_progress | resolved | closed
  response   String   @default("pending")  // pending | responded (côté admin)
  priority   String   @default("normal")   // urgent | high | normal | low
  assignedTo Int?               // FK → User (admin ou modérateur)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user          User?          @relation("TicketCreator", ...)
  assignedAdmin User?          @relation("TicketAssignee", ...)
  messages      SupportMessage[]
}

model SupportMessage {
  id         Int      @id @default(autoincrement())
  ticketId   Int
  userId     Int?               // null si message anonyme
  body       String
  isStaff    Boolean  @default(false)   // true = message admin/staff
  isInternal Boolean  @default(false)   // true = note interne (non visible user)
  createdAt  DateTime @default(now())

  ticket SupportTicket @relation(...)
}
```

---

## Notifications

### Vue d'ensemble

Les notifications sont stockées en base de données (table `Notification`). Elles sont créées automatiquement par le backend lors d'événements clés (3 notifications de bienvenue à l'inscription).

**Côté frontend** : pas de composant de cloche en temps réel connecté à l'API. La cloche dans `Header.jsx` affiche des notifications statiques (`DEFAULT_NOTIFICATIONS`) avec un point rouge qui disparaît au survol (`notifSeen=true`). La vraie lecture des notifications API se fait via la page Settings (Telegram QR).

**Canal de notification principal** : **Telegram** (pas d'email). L'utilisateur scanne un QR code dans Settings → Notifications pour lier son compte Telegram.

---

### Endpoints Notifications

```
GET   /api/notifications          → liste toutes les notifications du user
      Réponse: {
        notifications: [{ id, type, title, body, isRead, link, time }],
        unreadCount: N
      }
      "time" = formatRelativeTime(createdAt) :
        < 1min → "Just now"
        < 60min → "Xm ago"
        < 24h → "Xh ago"
        sinon → "Xd ago"

PATCH /api/notifications/:id/read    → marque une notif comme lue
      Réponse: { unreadCount: N }

PATCH /api/notifications/read-all   → marque toutes comme lues
      Réponse: { updated: N }
```

**Middleware** : `requireAuth` sur toutes les routes.
**Ordre des routes** : `read-all` est déclaré AVANT `/:id/read` pour éviter l'ambiguïté Express.

---

### Schéma BDD — Notification

```prisma
model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int
  type      String             // type d'événement (libre, ex: "welcome", "order", "deposit")
  title     String
  body      String   @default("")
  isRead    Boolean  @default(false)
  link      String   @default("")   // URL de navigation (ex: "/orders/123")
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isRead])
}
```

---

### Notifications de bienvenue (créées à l'inscription)

Lors du `POST /api/auth/register`, 3 notifications sont créées automatiquement :

```js
// Exemple de structure (logique backend auth.controller.js)
await prisma.notification.createMany({
  data: [
    { userId, type: 'welcome', title: 'Welcome!', body: 'Browse our latest products.', link: '/' },
    { userId, type: 'info', title: 'New arrivals in Accessories!', body: '', link: '/explore' },
    { userId, type: 'info', title: 'Limited stock on Focus V Aeris Kit.', body: '', link: '/product/focus-v-aeris-kit' },
  ]
})
```

---

### Header — Cloche de notifications (statique)

**Fichier** : `frontend/src/components/Header.jsx`

```jsx
// État local, pas connecté à l'API
const [notifSeen, setNotifSeen] = useState(false);

const DEFAULT_NOTIFICATIONS = [
  { id: 1, text: 'Welcome! Browse our latest products.', time: 'Just now' },
  { id: 2, text: 'New arrivals in Accessories!', time: '2h ago' },
  { id: 3, text: 'Limited stock on Focus V Aeris Kit.', time: '5h ago' },
];

// Au survol de .notif-wrap → setNotifSeen(true) → point rouge disparaît
// Lien "View all" → /news
```

**Structure HTML** :
```
.notif-wrap (onMouseEnter → notifSeen=true)
├── button.icon-btn
│   ├── <BellIcon />
│   └── .notif-dot (visible si !notifSeen)
└── .notif-menu (dropdown au survol)
    ├── .notif-menu-header "Notifications"
    ├── .notif-item × 3
    │   ├── .notif-text
    │   └── .notif-time
    └── <Link to="/news"> "View all"
```

---

### Préférences de notification (SettingsPage)

L'utilisateur configure ses préférences dans Settings → Notifications.

**5 toggles disponibles** :
| Clé (`notifToggles`) | Label affiché | Champ User (BDD) |
|---------------------|---------------|-----------------|
| `orders` | Orders | `notifOrders` |
| `deposits` | Deposits | `notifDeposits` |
| `tickets` | Tickets | `notifTickets` |
| `newProducts` | New products | `notifNewProducts` |
| `logins` | Logins | `notifLogins` |

**Canal** : Telegram. Scan du QR code dans la page Settings pour lier le compte Telegram à l'account.
Bouton "Auto-link Telegram" → lien Telegram deep link vers le bot.

---

## Paramètres Utilisateur (`/settings`)

### Fichier source
`frontend/src/pages/SettingsPage.jsx`

### Layout général
```
AccountSidebar (gauche)
└── account-main
    ├── <h3> Settings
    ├── Row 1 : 2 colonnes
    │   ├── Card 2FA
    │   └── Card Change Password
    ├── Card Hide Prices
    ├── Card Notifications (QR + toggles)
    └── Card API Keys
```

---

### Card 2FA — `settings-card`

2 onglets : **"Change/Add 2fa"** | **"Remove 2fa"**

```
Onglet "Change/Add 2fa" :
  Title : "Add Two Factor Authentication"
  Description : "Add extra security on your account..."
  Input : "Current password"
  Button : "Submit"

Onglet "Remove 2fa" :
  Title : "Remove Two Factor Authentication"
  Description : "Remove two factor authentication..."
  Input : "Current password"
  Button : "Submit"
```

**Note** : 2FA UI prête côté frontend mais backend non implémenté (`handle2FASubmit` appelle `showToast` seulement). Les champs `twoFaSecret` et `twoFaEnabled` existent dans la DB `User`.

---

### Card Change Password

**Validation frontend (en temps réel)** :
```js
function checkPassword(pw) {
  return {
    notEmpty:  pw.length > 0,
    noSpaces:  pw.length > 0 && !pw.includes(' '),
    minLength: pw.length >= 8,
    hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw),
    hasNumber: /\d/.test(pw),
    hasUpper:  /[A-Z]/.test(pw),
    hasLower:  /[a-z]/.test(pw),
  };
}
// Score 0–7 → trop faible (<= 2), Faible (<= 4), Bon (<= 6), Fort (7)
// Couleurs : #e53935 | #ff9800 | #fdd835 | #43a047
```

**Barre de force** : `width = (score / 7) * 100%`, couleur dynamique.

**8 requirements (avec icônes ✓/✗)** :
1. Passwords match
2. Not empty
3. No spaces
4. 8+ characters
5. 1+ symbol
6. 1+ number
7. 1+ capital letter
8. 1+ lowercase letter

**Endpoint** :
```
PUT /api/profile/password
Body: { currentPassword, newPassword }
```

**Règle** : `pwScore >= 5` requis avant soumission.
**Affichage** : 3 champs avec bouton eye-icon show/hide pour chacun.

---

### Card Hide Prices

Toggle switch. Quand activé : les prix sont masqués sur les pages Explore, Shop et produit.

**Champ BDD** : `User.hidePrices` (Boolean)

---

### Card Notifications

**QR Code** :
- SVG inline (140×140 px), motif QR simplifié
- Bouton "Auto-link Telegram" avec `<TelegramLinkIcon />`
- Texte informatif : "Notifications are sent via telegram. To start receiving notifications, scan the QR with telegram on your phone."
- Note sur les limitations Tor/navigateurs

**5 Toggle switches** pour `orders | deposits | tickets | newProducts | logins`

---

### Card API Keys

Pour accéder à l'API produits (`/api/products/scrape`).

**Usage** :
```bash
curl -H "x-api-key: <api-key>" <url>/api/products/scrape
```

**Génération** :
```
POST /api/profile/api-keys
Réponse: { apiKey: { key: "sk-xxxxx..." } }
Fallback si erreur : génère une clé locale "sk-" + 32 chars aléatoires
```

**Suppression** :
```
DELETE /api/profile/api-keys/:id
```

**Affichage de chaque clé** :
```
<code> clé complète | [CopyIcon] [TrashIcon rouge]
```

---

## System Status

### Fichiers sources
- `backend/src/controllers/admin/settings.controller.js` (Admin)
- Présumé : `frontend/src/pages/SystemStatusPage.jsx` (côté user)

### Endpoints
```
// Lecture (tous)
GET  /api/admin/system-status
     Réponse: { services: [...], incidents: [...] }

// Mise à jour d'un service (admin)
PUT  /api/admin/system-status/:id
     Body: { status?, uptimePct?, description? }

// Incidents (admin)
GET  /api/admin/system-status/incidents
     Réponse: { incidents: [...] } (100 derniers)

POST /api/admin/system-status/incidents
     Body: { dateLabel, title, status?, description? }
     Valeurs status : "resolved" (défaut), ou autres

PUT  /api/admin/system-status/incidents/:id
     Body: { dateLabel?, title?, status?, description? }

DELETE /api/admin/system-status/incidents/:id
```

### Schéma BDD

```prisma
model SystemStatus {
  id          Int      @id @default(autoincrement())
  service     String   @unique    // Nom du service (ex: "API", "Website", "Payment")
  description String   @default("")
  status      String   @default("operational")
              // operational | degraded | partial_outage | major_outage
  uptimePct   String   @default("100%")   // string (ex: "99.9%")
  updatedAt   DateTime @updatedAt
}

model SystemIncident {
  id          Int      @id @default(autoincrement())
  dateLabel   String             // ex: "July 3, 2026" (label affiché)
  title       String             // titre de l'incident
  status      String   @default("resolved")  // resolved | investigating | monitoring
  description String   @default("")
  createdAt   DateTime @default(now())
}
```

---

## Webhooks — Flux Détaillé

### BlockCypher (BTC / LTC / DOGE)

**Endpoint** : `POST /api/webhooks/blockcypher`

**Type 1 : Payment Forwarding Callback** (principal)
```
Payload reçu :
{
  input_address: "1ABC...",      // adresse de dépôt unique
  destination: "1XYZ...",        // adresse admin destination
  value: 123456,                 // montant en satoshis
  input_transaction_hash: "abc", // hash TX entrant
  transaction_hash: "def"        // hash TX sortante (après forward)
}

Traitement :
1. Réponse 200 immédiate (BlockCypher retente si timeout)
2. Cherche Deposit avec address=input_address, currency IN [BTC,LTC,DOGE], status IN [awaiting,partial]
3. GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
4. usdAmount = (satoshis / 1e8) * priceUSD (arrondi 2 décimales)
5. confirmDepositManually(deposit.id, usdAmount, null, txHash)
6. deleteBlockCypherForwarding(currency, deposit.hookId)
   → DELETE https://api.blockcypher.com/v1/{chain}/forwards/{id}?token=TOKEN
```

**Type 2 : Confirmed TX Webhook** (fallback legacy)
```
Payload : { addresses: [...], outputs: [...], confirmations: N, hash }
Condition : confirmations >= 1
Calcule satoshis depuis outputs.filter(o => o.addresses.includes(address))
```

**Suppression du forwarding** : après confirmation, le forwarding BlockCypher est supprimé pour éviter de recevoir à nouveau.

### Alchemy (ETH)

**Endpoint** : `POST /api/webhooks/alchemy`

```
Vérification signature :
HMAC-SHA256(body_json, ALCHEMY_SIGNING_KEY) doit == header x-alchemy-signature

Type attendu : "ADDRESS_ACTIVITY"
Filtre : activity.category === "external" && activity.asset === "ETH"

Pour chaque activité :
1. toAddress en lowercase
2. Cherche Deposit ETH avec address (insensitive) IN [awaiting,partial]
3. GET CoinGecko price pour "ethereum"
4. usdAmount = act.value (en ETH) × priceUSD
5. confirmDepositManually(deposit.id, usdAmount, null, act.hash)
```

### Fonction `confirmDepositManually` (wallet.service.js)

Utilisée par les webhooks ET par l'admin pour confirmer manuellement :

```js
// Utilise une transaction Prisma atomique
prisma.$transaction(async tx => {
  // 1. Crée Transaction type=deposit
  const txn = await tx.transaction.create({
    data: {
      frontendId: formatTxnId(Date.now()),
      userId:     deposit.userId,
      type:       'deposit',
      amount:     usdAmount,
      currency:   deposit.currency,
      status:     'confirmed',
      note:       `Deposit #${deposit.id}`,
      txHash:     txHash || undefined,
    }
  });

  // 2. Update Deposit
  await tx.deposit.update({
    where: { id: deposit.id },
    data: {
      transactionId: txn.id,
      status:        'confirmed',
      usdCredited:   usdAmount,
      confirmedAt:   new Date(),
    }
  });

  // 3. Incrémente balance user
  await tx.user.update({
    where: { id: deposit.userId },
    data:  { balance: { increment: usdAmount } }
  });

  return { newBalance: parseFloat(updatedUser.balance) };
});
```

---

## ETH Sweep — Logique Complète

**Fichier** : `backend/src/controllers/admin/eth.controller.js`

```
POST /api/admin/eth/sweep

Préconditions vérifiées :
1. ETH_HD_SEED configuré (12 mots seed phrase)
2. ALCHEMY_API_KEY configuré
3. eth_address dans SiteSetting configurée

Provider : Alchemy JSON-RPC
URL : https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}

Pour chaque Deposit ETH (status=confirmed, ethIndex non null) :
  1. Dériver wallet : HDNodeWallet.fromPhrase(seed, undefined, `m/44'/60'/0'/0/${ethIndex}`)
  2. wallet.connect(provider)
  3. balance = await provider.getBalance(wallet.address)
  4. Si balance === 0n → skipped (reason: "empty")
  5. gasPrice = feeData.maxFeePerGas || feeData.gasPrice || 20 gwei
  6. gasCost = 21_000n × gasPrice
  7. Si balance <= gasCost → skipped (reason: "balance too low to cover gas")
  8. Envoyer tx : { to: destination, value: balance - gasCost, gasLimit: 21000n }
  9. Ajouter à swept : { address, txHash: tx.hash, amountEth }

Réponse :
{
  swept: N,                    // nombre d'adresses sweep avec succès
  results: [{ address, txHash, amountEth }],
  skipped: [{ address, reason }]
}
```

---

## Schéma de Base de Données — Complet

### User (complet)

```prisma
model User {
  id                   Int       @id @default(autoincrement())
  passwordHash         String
  username             String    @unique
  email                String?   @unique
  markupPct            Decimal   @default(0) @db.Decimal(5, 2)
  signalDetails        String?
  sessionDetails       String?
  btcRefundAddress     String?
  xmrRefundAddress     String?
  telegramHandle       String?
  avatarUrl            String    @default("")
  bio                  String    @default("")
  role                 String    @default("customer")    // customer | moderator | admin
  isActive             Boolean   @default(true)
  tourCompleted        Boolean   @default(false)
  balance              Decimal   @default(0) @db.Decimal(10, 2)
  points               Int       @default(0)
  totalSpent           Decimal   @default(0) @db.Decimal(10, 2)
  twoFaSecret          String?
  twoFaEnabled         Boolean   @default(false)
  notifOrders          Boolean   @default(false)
  notifDeposits        Boolean   @default(false)
  notifTickets         Boolean   @default(false)
  notifNewProducts     Boolean   @default(false)
  notifLogins          Boolean   @default(false)
  hidePrices           Boolean   @default(false)
  lastLoginAt          DateTime?
  passwordResetToken   String?
  passwordResetExpiry  DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  orders          Order[]
  transactions    Transaction[]
  deposits        Deposit[]
  apiKeys         ApiKey[]
  wishlists       Wishlist[]
  notifications   Notification[]
  reviews         Review[]
  supportTickets  SupportTicket[] @relation("TicketCreator")
  assignedTickets SupportTicket[] @relation("TicketAssignee")
  giveawayEntries GiveawayEntry[]
  news            News[]          @relation("NewsAuthor")
  teamOwned       TeamMember[]    @relation("TeamOwner")
  teamMemberships TeamMember[]    @relation("TeamMember")
}
```

### Order (complet)

```prisma
model Order {
  id             Int      @id @default(autoincrement())
  frontendId     String?  @unique     // ex: "ORD-001234"
  userId         Int
  status         String   @default("processing")
                          // processing | shipped | delivered | cancelled | refunded
  paymentMethod  String                // XMR | BTC | DOGE | LTC (informatif)
  subtotal       Decimal  @db.Decimal(10, 2)
  shippingCost   Decimal  @default(16.99) @db.Decimal(10, 2)
  totalAmount    Decimal  @db.Decimal(10, 2)
  pointsEarned   Int      @default(0)
  shipName       String
  shipEmail      String
  shipAddress    String
  shipCity       String
  shipPostal     String
  shipCountry    String   @default("US")
  trackingNumber String?
  notes          String   @default("")
  placedAt       DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user         User          @relation(...)
  items        OrderItem[]
  transactions Transaction[]
}

model OrderItem {
  id              Int     @id @default(autoincrement())
  orderId         Int
  productId       Int?
  productOptionId Int?
  productName     String   // snapshot du nom au moment de la commande
  productBrand    String
  productImageUrl String  @default("")
  unitPrice       Decimal @db.Decimal(10, 2)
  priceType       String  @default("usd")
  quantity        Int
  lineTotal       Decimal @db.Decimal(10, 2)

  order         Order          @relation(...)
  product       Product?       @relation(...)
  productOption ProductOption? @relation(...)
}
```

### TeamMember

```prisma
model TeamMember {
  id             Int       @id @default(autoincrement())
  ownerId        Int                // User qui invite
  memberId       Int?               // User invité (null si non encore accepté)
  inviteUsername String             // username invité
  status         String   @default("pending")  // pending | accepted | rejected
  invitedAt      DateTime @default(now())
  joinedAt       DateTime?

  owner  User  @relation("TeamOwner", ...)
  member User? @relation("TeamMember", ...)
}
```

### Wishlist

```prisma
model Wishlist {
  userId    Int
  productId Int
  createdAt DateTime @default(now())

  user    User    @relation(...)
  product Product @relation(...)

  @@id([userId, productId])   // clé composite, une entrée par paire user/produit
}
```

### Review

```prisma
model Review {
  id         Int      @id @default(autoincrement())
  productId  Int
  userId     Int?                // null si anonyme
  rating     Int                 // 1–5
  title      String   @default("")
  body       String   @default("")
  isApproved Boolean  @default(false)  // requiert approbation admin
  createdAt  DateTime @default(now())
}
```

### Content (News, Giveaway, FAQ)

```prisma
model News {
  id          Int       @id @default(autoincrement())
  title       String
  slug        String    @unique
  category    String    @default("")
  excerpt     String    @default("")
  body        String    @default("")
  imageUrl    String?
  tag         String    @default("")
  tagColor    String    @default("#607d8b")
  isPublished Boolean   @default(false)
  authorId    Int?
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
}

model Giveaway {
  id            Int       @id @default(autoincrement())
  title         String
  badge         String    @default("")
  gradientFrom  String    @default("#e91e63")
  gradientTo    String    @default("#9c27b0")
  gradientAngle Int       @default(135)
  value         String    @default("")          // ex: "$500 value"
  description   String    @default("")
  prizes        Json      @default("[]")        // tableau de prix
  endsAt        DateTime?
  maxEntries    Int?
  entriesCount  Int       @default(0)
  winnersCount  Int       @default(1)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())

  entries GiveawayEntry[]
}

model GiveawayEntry {
  id         Int      @id @default(autoincrement())
  giveawayId Int
  userId     Int
  enteredAt  DateTime @default(now())

  @@unique([giveawayId, userId])   // un seul entry par user par giveaway
}

model Faq {
  id        Int      @id @default(autoincrement())
  question  String
  answer    String
  sortOrder Int      @default(0)    // pour réorganisation drag-and-drop
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

### SiteSetting — clés complètes

```prisma
model SiteSetting {
  key   String @id
  value String
  type  String @default("string")  // string | boolean | number
}
```

Toutes les clés utilisées :

| Clé | Type | Description |
|-----|------|-------------|
| `site_name` | string | Nom du site |
| `maintenance_mode` | boolean | Si "true" → store inaccessible |
| `registration_open` | boolean | Si "false" → inscriptions bloquées |
| `shipping_cost` | number | Coût livraison ($) |
| `shipping_free_threshold` | number | Seuil livraison gratuite ($) |
| `shipping_deadline_h` | number | Heure du timer livraison same-day |
| `shipping_deadline_m` | number | Minute du timer livraison same-day |
| `points_rate` | number | Points gagnés par $1 dépensé (ex: 0.5) |
| `deposit_expiry_hours` | number | Durée de vie adresses dépôt (défaut 12) |
| `min_deposit` | number | Dépôt minimum ($) |
| `max_deposit` | number | Dépôt maximum ($) |
| `btc_address` | string | Adresse BTC destination (auto-forward) |
| `ltc_address` | string | Adresse LTC destination (auto-forward) |
| `doge_address` | string | Adresse DOGE destination (auto-forward) |
| `eth_address` | string | Adresse ETH destination (sweep manuel) |
| `xmr_address` | string | Adresse XMR unique partagée |

**Lecture** : `GET /api/admin/settings` → `{ settings: { key: value, ... } }`
**Écriture** : `PUT /api/admin/settings` → Body `{ key: value, ... }` (upsert en transaction)

---

## Endpoints API — Complets et Détaillés

### Auth
```
POST /api/auth/register   Body: { username, password }
POST /api/auth/login      Body: { username, password }   → { token, refreshToken, user }
POST /api/auth/refresh    Body: { refreshToken }          → { token }
POST /api/auth/logout
```

### Profile (requireAuth)
```
GET  /api/profile
PUT  /api/profile         Body: { bio, telegramHandle, signalDetails,
                                  sessionDetails, btcRefundAddress, xmrRefundAddress }
PUT  /api/profile/password  Body: { currentPassword, newPassword }
POST /api/profile/api-keys  → génère une nouvelle API key
DELETE /api/profile/api-keys/:id
```

### Wallet (requireAuth)
```
GET  /api/wallet              → { balance, points, totalSpent, tier, cashback, remaining, daysLeft }
GET  /api/wallet/balance      → { balance }
GET  /api/wallet/deposits     → { deposits, pagination }
GET  /api/wallet/deposits/:id
POST /api/wallet/deposit      Body: { currency: "BTC"|"LTC"|"DOGE"|"ETH"|"XMR" }
                              → { depositId, address, currency, expiresAt }
GET  /api/wallet/transactions → { transactions, pagination }
```

### Commandes (requireAuth)
```
GET  /api/orders
POST /api/orders    Body: { items:[{productId,quantity}], shippingAddress,
                            paymentMethod, name, email }
                    → { order, newBalance }
GET  /api/orders/:id
```

### Support (optionalAuth)
```
GET   /api/support/tickets
POST  /api/support/tickets      Body: { category, subject, message }
GET   /api/support/tickets/:id
POST  /api/support/tickets/:id/messages   Body: { message }
PATCH /api/support/tickets/:id/close
```

### Notifications (requireAuth)
```
GET   /api/notifications         → { notifications:[...], unreadCount }
PATCH /api/notifications/read-all
PATCH /api/notifications/:id/read
```

### Webhooks (publics — pas d'auth)
```
POST /api/webhooks/blockcypher   → confirmation BTC/LTC/DOGE
POST /api/webhooks/alchemy       → confirmation ETH
```

### Contenu public
```
GET /api/content/settings        → settings publics pour le frontend
GET /api/categories
GET /api/products
GET /api/products/scrape         Header: x-api-key (ApiKey)
GET /api/news
GET /api/faq
```

### Admin (requireAuth + requireAdmin)
```
// Dashboard
GET /api/admin/dashboard

// Users
GET    /api/admin/users?page&limit&search&tier&role&isActive&sortBy&sortOrder
POST   /api/admin/users              Body: { username, password, role }
GET    /api/admin/users/:id
PUT    /api/admin/users/:id          Body: { username, role, isActive, markupPct }
PATCH  /api/admin/users/:id/ban
PATCH  /api/admin/users/:id/password Body: { password }
POST   /api/admin/users/:id/wallet/adjust  Body: { type, amount, reason }

// Orders
GET   /api/admin/orders?page&limit&search&status&paymentMethod
PATCH /api/admin/orders/:id/status   Body: { status }
PATCH /api/admin/orders/:id/tracking Body: { trackingNumber, carrier }

// Products
GET    /api/admin/products
POST   /api/admin/products           multipart/form-data (image upload)
GET    /api/admin/products/:id
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id
PATCH  /api/admin/products/:id/stock Body: { stock }

// Deposits
GET   /api/admin/deposits?page&limit&status&currency
PATCH /api/admin/deposits/:id/confirm Body: { usdAmount, note? }
PATCH /api/admin/deposits/:id/expire

// Transactions
GET /api/admin/transactions?page&limit&search&type&status&currency&dateFrom&dateTo

// Support
GET   /api/admin/support?page&limit&status&priority&search&category&assignedTo
GET   /api/admin/support/stats       → { open, in_progress, resolved, closed }
GET   /api/admin/support/:id         → ticket + messages + user + assignee
POST  /api/admin/support/tickets/:id/messages  Body: { message, isInternal }
PATCH /api/admin/support/tickets/:id/status    Body: { status }
PATCH /api/admin/support/tickets/:id/priority  Body: { priority }
PATCH /api/admin/support/tickets/:id/assign    Body: { adminId }

// Reviews
GET    /api/admin/reviews
PATCH  /api/admin/reviews/:id/approve
DELETE /api/admin/reviews/:id

// Content
GET    /api/admin/news
POST   /api/admin/news
PUT    /api/admin/news/:id
DELETE /api/admin/news/:id
GET    /api/admin/faq
POST   /api/admin/faq
PUT    /api/admin/faq/reorder   Body: [{ id, sortOrder }]
PUT    /api/admin/faq/:id
DELETE /api/admin/faq/:id
GET    /api/admin/giveaways
POST   /api/admin/giveaways
PUT    /api/admin/giveaways/:id
DELETE /api/admin/giveaways/:id
GET    /api/admin/giveaways/:id/entries

// Analytics
GET /api/admin/analytics?period=7d|30d|90d|1y

// Settings
GET  /api/admin/settings
PUT  /api/admin/settings   Body: { key: value, ... }

// System Status
GET    /api/admin/system-status
PUT    /api/admin/system-status/:id  Body: { status?, uptimePct?, description? }
GET    /api/admin/system-status/incidents
POST   /api/admin/system-status/incidents  Body: { dateLabel, title, status?, description? }
PUT    /api/admin/system-status/incidents/:id
DELETE /api/admin/system-status/incidents/:id

// ETH Sweep
POST /api/admin/eth/sweep

// Catalog (pour dropdowns du formulaire produit)
GET /api/admin/categories
GET /api/admin/brands
```

---

## Utilitaires Backend

### `formatTxnId` / `formatTicketId` (`utils/formatters.js`)
Génère un ID lisible depuis un timestamp :
```js
formatTxnId(Date.now())    // utilisé pour Transaction.frontendId
formatTicketId(Date.now()) // utilisé pour SupportTicket.frontendId
```

### `parsePaginationParams` + `buildPagination` (`utils/pagination.js`)
```js
// Entrée : req.query { page: "2", limit: "20" }
// Sortie : { page: 2, limit: 20 } (avec guards)

// buildPagination(page, limit, total)
// Retourne : { page, limit, total, totalPages, hasNext, hasPrev }
```

### `asyncHandler` (`utils/asyncHandler.js`)
Wrapper pour éviter try/catch dans chaque controller admin :
```js
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
```

### `apiResponse` (`utils/apiResponse.js`)
```js
success(res, data, statusCode = 200)
// → { success: true, data: { ...data } }

error(res, message, statusCode = 400)
// → { success: false, error: message }
```

### `getTierInfo` (wallet.service.js)
```js
const TIERS = [
  { name: 'basic',     minSpent: 0,    cashback: 0.005 },  // 0.5%
  { name: 'preferred', minSpent: 1000, cashback: 0.010 },  // 1.0%
  { name: 'gold',      minSpent: 2000, cashback: 0.013 },  // 1.3%
  { name: 'platinum',  minSpent: 5000, cashback: 0.015 },  // 1.5%
];

// retourne : { name, minSpent, cashback, remaining }
// remaining = écart jusqu'au prochain tier (0 si plateau)
```

### `deleteBlockCypherForwarding` (crypto.service.js)
Appelée après confirmation d'un dépôt BTC/LTC/DOGE pour nettoyer le webhook :
```
DELETE https://api.blockcypher.com/v1/{chain}/forwards/{forwardingId}?token=TOKEN
```

---

## Middlewares Backend

### `requireAuth`
- Extrait Bearer token du header Authorization
- Vérifie JWT avec `JWT_SECRET`
- Attache `req.user = { id, role, ... }`
- 401 si token invalide ou absent

### `requireAdmin`
- Vérifie `req.user.role === 'admin'` (ou 'moderator' selon les routes)
- 403 si insuffisant

### `optionalAuth`
- Tente de vérifier le token si présent
- Attache `req.user` si valide
- Passe silencieusement si pas de token (req.user = null)
- Utilisé pour support tickets (anonymes autorisés)

### `validate(schema)` (Zod)
```js
// Valide req.body contre un schéma Zod
// 400 avec { success: false, error: { issues: [...] } } si invalide
```

### `uploadProductImage` (Multer)
- Gère `multipart/form-data` pour upload image produit
- Champ : `image` (single file)
- Limite : `MAX_FILE_SIZE` (défaut 5 MB)
- Destination : `UPLOAD_DIR` ou Cloudinary

### `errorHandler` (global)
- Catch-all Express error middleware
- Retourne `{ success: false, error: message, status }` en JSON
