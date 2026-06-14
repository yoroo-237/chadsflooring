# Spécifications Backend & Dashboard Admin — Canna Express Shop

> Généré le 2026-06-09 | Analyse exhaustive ligne par ligne de tous les 34 fichiers source

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Stack technique](#2-stack-technique)
3. [Données réelles du frontend](#3-données-réelles-du-frontend)
4. [Schéma de base de données PostgreSQL](#4-schéma-de-base-de-données-postgresql)
5. [API REST — Endpoints complets](#5-api-rest--endpoints-complets)
6. [Logique métier backend](#6-logique-métier-backend)
7. [Authentification & Sécurité](#7-authentification--sécurité)
8. [Architecture des fichiers Express](#8-architecture-des-fichiers-express)
9. [Dashboard Admin — Spécifications complètes](#9-dashboard-admin--spécifications-complètes)
10. [Intégration Frontend → Backend](#10-intégration-frontend--backend)
11. [Plan d'implémentation priorisé](#11-plan-dimplémentation-priorisé)

---

## 1. Vue d'ensemble du projet

**Canna Express** est un e-commerce crypto-friendly vendant des produits cannabis (CBD, vaporisateurs, comestibles, etc.) avec :

- **85 produits** répartis en **12 catégories actives** (+ 5 produits Rewards)
- Paiements en crypto-monnaies : **XMR, BTC, ETH** (checkout) + **BTC, DOGE, LTC, XMR** (dépôts wallet)
- Système de wallet interne (solde en USD, rechargeable via crypto)
- Système de points et tiers de fidélité (4 niveaux)
- Support client intégré (tickets + widget chat avec 9 situations + sous-questions)
- Favoris (stash), filtres avancés, recherche
- Page Explore avec carousels (Trending, New Items, Shop the Sale, Best Selling)
- Profil enrichi (Signal, Session, BTC/XMR refund addresses, Telegram)
- Page "Your Team" (présente dans le sidebar mais **non implémentée** côté frontend)

**Situation actuelle** : toutes les données sont statiques, aucune persistance, pas d'auth.

---

## 2. Stack technique

### Backend
| Composant | Choix | Justification |
|-----------|-------|---------------|
| Runtime | Node.js >= 18 | |
| Framework | Express 4.x | |
| Base de données | PostgreSQL 15+ | |
| ORM/Query builder | Prisma ou pg (raw) | |
| Auth | JWT (jsonwebtoken) | Access 15min + Refresh 7j |
| Hash passwords | bcrypt | |
| Validation | Zod ou Joi | |
| Upload | Multer | Avatars, images produits |
| Email | Nodemailer | Confirmations, notifications |
| Variables env | dotenv | |
| CORS | cors | |
| Rate limiting | express-rate-limit | Anti-brute force |
| Logs | morgan | |
| Sécurité headers | helmet | |

### Frontend — dépendances actuelles
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^7.15.1",
  "react-scripts": "5.0.1"
}
```
À ajouter : `axios` (ou fetch natif avec wrapper)

---

## 3. Données réelles du frontend

### 3.1 Catégories exactes (depuis `src/data/products.js`)

```javascript
// Ordre exact dans le fichier
{ id: '4',  label: 'Accessories' }
{ id: '11', label: 'BYOB' }          // Build Your Own Bundle
{ id: '1',  label: 'Carts' }
{ id: '3',  label: 'Concentrates' }
{ id: '6',  label: 'Disposables' }
{ id: '7',  label: 'Edibles' }
{ id: '2',  label: 'Flower' }
{ id: '8',  label: 'Merch' }
{ id: '13', label: 'Munchies' }      // NB: id=13, pas une catégorie "CBD"
{ id: '9',  label: 'Pre-rolls' }
{ id: '10', label: 'Topical' }       // NB: id=10, pas "Vaporizers"
{ id: '-1', label: 'Rewards' }       // Produits achetables avec points uniquement
```

**IMPORTANT** : La CategoryNav affiche Explore → [catégories sans Rewards] → Rewards. Les catégories manquantes dans la première version (BYOB, Munchies, Topical) sont réelles.

### 3.2 Marques réelles présentes dans le catalogue

Moxie, Focus V, Maven Torch, Santa Cruz Shredder, Cali Crusher, Formula 420, Raw, 710 Labs, PlugPlay, Chad's, Wyld, Kiva, Alien Labs, Connected, Jungle Boys, Lay's, Oreo, Haribo, PopCorners, Ben & Jerry's, Takis, Papa & Barkley, Mary's Medicinals

### 3.3 Répartition des produits par catégorie

| Catégorie | ID | Nb produits |
|-----------|-----|-------------|
| Accessories | 4 | 15 |
| BYOB | 11 | 5 |
| Carts | 1 | 7 |
| Concentrates | 3 | 6 |
| Disposables | 6 | 5 |
| Edibles | 7 | 7 |
| Flower | 2 | 8 |
| Merch | 8 | 5 |
| Munchies | 13 | 6 |
| Pre-rolls | 9 | 6 |
| Topical | 10 | 5 |
| Rewards | -1 | 5 |
| **Total** | | **80 + 5 = 85** |

### 3.4 Schéma exact d'un produit (frontend)

```javascript
{
  id: number,           // ex: 13287, 30001, 120005
  brand: string,        // ex: "Moxie", "Chad's", "710 Labs"
  brandSlug: string,    // ex: "Moxie", "chads", "710Labs" (pas toujours kebab-case)
  name: string,         // ex: "Blue Dream Cart 1g"
  price: string,        // "$34.99" (USD) ou "P500" (points)
  stock: number,        // 0 = rupture, 999 = illimité
  rating: number,       // 0.0 à 5.0 (0 = pas encore noté)
  reviewCount: number,  // 0 si aucun avis
  options: number|null, // null = pas de variante, sinon nombre d'options
  image: string,        // URL CDN chadsflooring.bz
  category: string,     // ID catégorie en string: '1', '4', '-1', etc.
}
```

### 3.5 Devises crypto — usage exact

**Checkout** (paiement commande) : `XMR | BTC | ETH`
```javascript
// CheckoutPage.jsx ligne 171-173
{ value: 'XMR', label: 'Monero (XMR)',   icon: 'ɱ' (orange #f26822) }
{ value: 'BTC', label: 'Bitcoin (BTC)',  icon: '₿' }
{ value: 'ETH', label: 'Ethereum (ETH)', icon: 'Ξ' }
```

**Wallet / Dépôts** : `BTC | DOGE | LTC | XMR` — 4 devises différentes!
```javascript
// WalletPage.jsx lignes 5-9
{ key: 'BTC',  label: 'Bitcoin',  note: 'suggested fee: 4 sat/vb' }
{ key: 'DOGE', label: 'Dogecoin', note: '' }
{ key: 'LTC',  label: 'Litecoin', note: '' }
{ key: 'XMR',  label: 'Monero',   note: '' }
```

### 3.6 Frais de livraison — incohérence à résoudre

- **CartPage** : `SHIPPING = 16.99` — affiché dans le résumé de commande
- **CheckoutPage** : affiche `Free` pour le shipping dans le résumé
- **ShippingPolicyPage** : Standard $5.99, Express $14.99, Free si > $75
- Le backend doit définir la règle canonique (voir section 6.1)

### 3.7 Schéma exact d'une commande (frontend actuel)

```javascript
// AppContext.jsx — placeOrder()
{
  id: `ORD-${Date.now()}`,       // ex: "ORD-1717934400000"
  date: new Date().toISOString(), // ISO 8601
  items: [...cartItems],          // snapshot des produits du panier
  total: number,                  // somme des prix (sans shipping dans CheckoutPage!)
  status: 'Processing',           // toujours 'Processing' à la création
  address: string,                // "${form.address}, ${form.city} ${form.postal}"
  payment: 'XMR'|'BTC'|'ETH',
  // ABSENT: name, email, country, shipping_cost, tracking
}
```

### 3.8 Profil utilisateur — champs réels (ProfilePage)

```javascript
// Plus riche que documenté initialement
{
  username: string,                // "Jadevice55" (défaut "Guest User")
  markup: number,                  // 0% (champ "Logo" avec markup %)
  signal_details: string|null,     // Adresse Signal (éditable)
  session_details: string|null,    // Adresse Session (éditable)
  btc_refund_address: string|null, // Adresse BTC pour remboursements
  xmr_refund_address: string|null, // Adresse XMR pour remboursements
  telegram_handle: string|null,    // Compte Telegram (auto-link disponible)
}
```

### 3.9 Paramètres de notification (SettingsPage)

```javascript
// Via Telegram (QR code + auto-link), pas par email
{
  notif_orders: boolean,      // Commandes
  notif_deposits: boolean,    // Dépôts
  notif_tickets: boolean,     // Tickets support
  notif_newProducts: boolean, // Nouveaux produits
  notif_logins: boolean,      // Connexions
}
```

### 3.10 Clés API (SettingsPage)

- Format généré : `sk-` + 32 chars alphanumériques aléatoires
- Utilisées avec l'en-tête `x-api-key: <api-key>` (pas Authorization Bearer)
- Endpoint documenté : `curl -H "x-api-key: <api-key>" <url>/api/products/scrape`
- Actions : Générer, Copier, Supprimer

### 3.11 Giveaways — structure exacte

```javascript
{
  id: number,
  title: string,
  badge: string,           // ex: "🔥 HOT", "⚡ FLASH", "⭐ VIP"
  color: string,           // Gradient CSS ex: "linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)"
  value: string,           // ex: "$500+"
  description: string,
  prizes: string[],        // Liste de prix (🥇🥈🥉)
  endDate: ISO8601,        // Countdown en live (d/h/m/s)
  entries: number,         // Nombre d'inscriptions
  winners: number,         // Nombre de gagnants
}
```

### 3.12 Articles de news — structure exacte

```javascript
{
  id: number,
  title: string,
  date: string,            // ex: "May 10, 2026" (format texte, à convertir)
  category: string,        // "Products", "Giveaways", "Updates", "Rewards"
  image: string|null,      // URL ou null (placeholder 📰)
  excerpt: string,
  tag: string,             // ex: "New", "Hot", "Update", "Event", "Maintenance"
  tagColor: string,        // Couleur hex du badge
}
```

### 3.13 System Status — services existants

| Service | Description | Statuts possibles |
|---------|-------------|-------------------|
| Website | Main storefront | operational/degraded/outage |
| API | Product and order REST API | idem |
| Payment Processing | XMR/BTC/ETH gateway | idem |
| Order Management | Order creation/tracking | idem |
| Search | Product search/filtering | idem |
| Shipping Integration | Carrier tracking/labels | idem |
| Support System | Ticket management | idem |
| CDN / Media | Images/assets | idem |

### 3.14 Tiers de fidélité — valeurs exactes

```javascript
// RewardsPage.jsx lignes 50-54
{ name: 'Basic',     range: '$0 - $999',        cashback: '0.5%',  color: '#2E7D5B' }
{ name: 'Preferred', range: '$1,000 - $1,999',  cashback: '1.0%',  color: '#2F6FB0' }
{ name: 'Gold',      range: '$2,000 - $4,999',  cashback: '1.3%',  color: '#D4A843' }
{ name: 'Platinum',  range: '$5,000 - $19,999', cashback: '1.5%',  color: '#E8E4DA' }
```

Calcul points : `Math.floor(totalSpent * 0.5)` (0.5 point par dollar dépensé)

### 3.15 Situations support (SupportWidget)

**9 situations** :
Missing/Wrong Items, Delayed Package, Website Bug, Cancelled Order, Emergency Contact, Website Feature Request, Deposit Issue, Product Requests, Missing Product Image, Other

**3 sous-options** : Order, Deposit, Not related

### 3.16 Catégories support (SupportPage)

8 catégories : General, Order Issue, Payment, Shipping, Product Question, Account, Technical, Other

### 3.17 Brands de la page Explore (hardcodés)

```javascript
// ExplorePage.jsx — carousel de logos marques
Luigi, Maven, Jeeter, Stiiizy, Cookies, Dime, 710 Labs, Sherbinskis, Puffco, Alien Labs
// Images depuis: https://chadsflooring.bz/assets/images/brands/industry-brands/
```

### 3.18 Sections de la page Explore

| Section | Source de données | API backend nécessaire |
|---------|-------------------|----------------------|
| Top Categories | 8 catégories hardcodées | `GET /categories?featured=true` |
| Trending Items | `products.slice(0, 9)` | `GET /products?sort=trending&limit=9` |
| New Items | `products.slice(9, 18)` | `GET /products?sort=newest&limit=9` |
| Brand logos | 10 marques hardcodées | `GET /brands?featured=true` |
| Best Selling Carts | 5 premiers Carts | `GET /products?category=carts&sort=bestselling&limit=5` |
| Shop the Sale | `products.slice(18, 27)` | `GET /products?onSale=true&limit=9` |

### 3.19 Route manquante

`/team` est dans le menu `AccountSidebar` mais **n'existe pas dans App.jsx** et il n'y a pas de fichier `TeamPage.jsx`. Cette page doit être créée.

---

## 4. Schéma de base de données PostgreSQL

### 4.1 Table `users`

```sql
CREATE TABLE users (
  id                    SERIAL PRIMARY KEY,
  email                 VARCHAR(255) UNIQUE NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  username              VARCHAR(150) NOT NULL DEFAULT 'Guest User',
  markup_pct            DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  -- Profil enrichi
  signal_details        VARCHAR(500),
  session_details       VARCHAR(500),
  btc_refund_address    VARCHAR(255),
  xmr_refund_address    VARCHAR(255),
  telegram_handle       VARCHAR(150),
  avatar_url            VARCHAR(500) DEFAULT '',
  bio                   TEXT DEFAULT '',
  -- Rôle & statut
  role                  VARCHAR(20) NOT NULL DEFAULT 'customer',
    -- 'customer' | 'admin' | 'moderator'
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  -- Wallet
  balance               DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  points                INTEGER NOT NULL DEFAULT 0,
  total_spent           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  -- Sécurité
  two_fa_secret         VARCHAR(100),
  two_fa_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  -- Notifications (via Telegram)
  notif_orders          BOOLEAN NOT NULL DEFAULT FALSE,
  notif_deposits        BOOLEAN NOT NULL DEFAULT FALSE,
  notif_tickets         BOOLEAN NOT NULL DEFAULT FALSE,
  notif_new_products    BOOLEAN NOT NULL DEFAULT FALSE,
  notif_logins          BOOLEAN NOT NULL DEFAULT FALSE,
  -- Préférences
  hide_prices           BOOLEAN NOT NULL DEFAULT FALSE,
  -- Métadonnées
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### 4.2 Table `categories`

```sql
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  frontend_id VARCHAR(10) UNIQUE NOT NULL,
    -- Correspond à l'id dans le frontend: '1', '4', '11', '-1', etc.
  slug        VARCHAR(50) UNIQUE NOT NULL,
  label       VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  image_url   VARCHAR(500) DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed exact depuis products.js
INSERT INTO categories (frontend_id, slug, label, sort_order, is_featured) VALUES
  ('4',  'accessories',  'Accessories',  1,  TRUE),
  ('11', 'byob',         'BYOB',         2,  TRUE),
  ('1',  'carts',        'Carts',        3,  TRUE),
  ('3',  'concentrates', 'Concentrates', 4,  TRUE),
  ('6',  'disposables',  'Disposables',  5,  TRUE),
  ('7',  'edibles',      'Edibles',      6,  TRUE),
  ('2',  'flower',       'Flower',       7,  TRUE),
  ('8',  'merch',        'Merch',        8,  FALSE),
  ('13', 'munchies',     'Munchies',     9,  FALSE),
  ('9',  'pre-rolls',    'Pre-rolls',    10, TRUE),
  ('10', 'topical',      'Topical',      11, FALSE),
  ('-1', 'rewards',      'Rewards',      12, FALSE);
```

### 4.3 Table `brands`

```sql
CREATE TABLE brands (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  slug         VARCHAR(100) UNIQUE NOT NULL,
    -- Correspond à brandSlug dans le frontend (ex: "Moxie", "710Labs", "chads")
  logo_url     VARCHAR(500) DEFAULT '',
  website_url  VARCHAR(500) DEFAULT '',
  description  TEXT DEFAULT '',
  is_featured  BOOLEAN NOT NULL DEFAULT FALSE,
    -- TRUE pour les 10 marques de la page Explore
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed des marques réelles du catalogue
INSERT INTO brands (name, slug, is_featured) VALUES
  ('Moxie',           'Moxie',         FALSE),
  ('Focus V',         'focusv',        FALSE),
  ('Maven Torch',     'Maven',         TRUE),
  ('Santa Cruz Shredder', 'santacruz', FALSE),
  ('Cali Crusher',    'CaliCrusher',   FALSE),
  ('Formula 420',     'formula420',    FALSE),
  ('Raw',             'raw',           FALSE),
  ('710 Labs',        '710Labs',       TRUE),
  ('PlugPlay',        'PlugPlay',      FALSE),
  ('Chad''s',         'chads',         FALSE),
  ('Wyld',            'wyld',          FALSE),
  ('Kiva',            'kiva',          FALSE),
  ('Alien Labs',      'alienlabs',     TRUE),
  ('Connected',       'connected',     FALSE),
  ('Jungle Boys',     'jungleboys',    FALSE),
  ('Lay''s',          'lays',          FALSE),
  ('Oreo',            'oreo',          FALSE),
  ('Haribo',          'haribo',        FALSE),
  ('PopCorners',      'popcorners',    FALSE),
  ('Ben & Jerry''s',  'benjerry',      FALSE),
  ('Takis',           'takis',         FALSE),
  ('Papa & Barkley',  'papabarkley',   FALSE),
  ('Mary''s Medicinals', 'marysmedicinals', FALSE);
```

### 4.4 Table `products`

```sql
CREATE TABLE products (
  id             SERIAL PRIMARY KEY,
  frontend_id    INTEGER UNIQUE,
    -- Préserve les IDs originaux (13287, 30001, etc.) pour la migration
  brand_id       INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name           VARCHAR(255) NOT NULL,
  slug           VARCHAR(255) UNIQUE NOT NULL,
  description    TEXT DEFAULT '',
  price          DECIMAL(10,2) NOT NULL,
  price_type     VARCHAR(10) NOT NULL DEFAULT 'usd',
    -- 'usd' (prix en $) | 'points' (prix en P — Rewards uniquement)
  stock          INTEGER NOT NULL DEFAULT 0,
  image_url      VARCHAR(500) DEFAULT '',
  rating         DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  review_count   INTEGER NOT NULL DEFAULT 0,
  options_count  INTEGER DEFAULT NULL,
    -- NULL = pas de variante, sinon nombre d'options
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured    BOOLEAN NOT NULL DEFAULT FALSE,
  is_trending    BOOLEAN NOT NULL DEFAULT FALSE,
  is_new         BOOLEAN NOT NULL DEFAULT FALSE,
  is_on_sale     BOOLEAN NOT NULL DEFAULT FALSE,
  is_best_selling BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_stock ON products(stock);
CREATE INDEX idx_products_trending ON products(is_trending, is_active);
CREATE INDEX idx_products_new ON products(is_new, created_at DESC);
```

### 4.5 Table `product_options`

```sql
CREATE TABLE product_options (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label       VARCHAR(150) NOT NULL,
    -- ex: "1g", "3.5g", "7g", "Blue", "Red"
  price_delta DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  stock       INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
```

### 4.6 Table `reviews`

```sql
CREATE TABLE reviews (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       VARCHAR(255) DEFAULT '',
  body        TEXT DEFAULT '',
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON reviews(product_id, is_approved);
```

### 4.7 Table `orders`

```sql
CREATE TABLE orders (
  id              SERIAL PRIMARY KEY,
  frontend_id     VARCHAR(30) UNIQUE,
    -- Format "ORD-{timestamp}" pour compatibilité affichage
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status          VARCHAR(20) NOT NULL DEFAULT 'processing',
    -- 'processing' | 'shipped' | 'delivered' | 'cancelled'
  payment_method  VARCHAR(5) NOT NULL,
    -- 'XMR' | 'BTC' | 'ETH'
  subtotal        DECIMAL(10,2) NOT NULL,
  shipping_cost   DECIMAL(8,2) NOT NULL DEFAULT 16.99,
  total_amount    DECIMAL(10,2) NOT NULL,
    -- = subtotal + shipping_cost
  points_earned   INTEGER NOT NULL DEFAULT 0,
  -- Snapshot adresse livraison
  ship_name       VARCHAR(150) NOT NULL,
  ship_email      VARCHAR(255) NOT NULL,
  ship_address    VARCHAR(300) NOT NULL,
  ship_city       VARCHAR(100) NOT NULL,
  ship_postal     VARCHAR(20) NOT NULL,
  ship_country    VARCHAR(5) NOT NULL DEFAULT 'US',
  -- Suivi
  tracking_number VARCHAR(100),
  notes           TEXT DEFAULT '',
  placed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_placed ON orders(placed_at DESC);
```

### 4.8 Table `order_items`

```sql
CREATE TABLE order_items (
  id                SERIAL PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_option_id INTEGER REFERENCES product_options(id) ON DELETE SET NULL,
  -- Snapshot données produit
  product_name      VARCHAR(255) NOT NULL,
  product_brand     VARCHAR(150) NOT NULL,
  product_image_url VARCHAR(500) DEFAULT '',
  unit_price        DECIMAL(10,2) NOT NULL,
  price_type        VARCHAR(10) NOT NULL DEFAULT 'usd',
  quantity          INTEGER NOT NULL,
  line_total        DECIMAL(10,2) NOT NULL
);
```

### 4.9 Table `transactions`

```sql
CREATE TABLE transactions (
  id          SERIAL PRIMARY KEY,
  frontend_id VARCHAR(30) UNIQUE,
    -- Format "TXN-{timestamp}"
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  type        VARCHAR(20) NOT NULL,
    -- 'deposit' | 'purchase' | 'refund' | 'adjustment'
  amount      DECIMAL(10,2) NOT NULL,
    -- Positif = crédit, négatif = débit
  currency    VARCHAR(10) NOT NULL,
    -- 'USD' | 'XMR' | 'BTC' | 'ETH' | 'DOGE' | 'LTC'
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'confirmed' | 'failed' | 'cancelled'
  note        TEXT DEFAULT '',
  tx_hash     VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
```

### 4.10 Table `deposits`

```sql
CREATE TABLE deposits (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id    INTEGER REFERENCES transactions(id),
  currency          VARCHAR(10) NOT NULL,
    -- 'BTC' | 'DOGE' | 'LTC' | 'XMR'
  address           VARCHAR(255) NOT NULL,
  amount_expected   DECIMAL(20,8),
  amount_received   DECIMAL(20,8) DEFAULT 0,
  usd_credited      DECIMAL(10,2) DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'awaiting',
    -- 'awaiting' | 'partial' | 'confirmed' | 'expired'
  expires_at        TIMESTAMPTZ,
    -- Par défaut NOW() + 12 heures (mentionné dans les terms frontend)
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.11 Table `api_keys`

```sql
CREATE TABLE api_keys (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash    VARCHAR(255) NOT NULL,
  key_prefix  VARCHAR(10) NOT NULL,
    -- Premiers chars pour identification ex: "sk-abc123"
  label       VARCHAR(100) DEFAULT 'Default Key',
  last_used   TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Note: format frontend = "sk-" + 32 chars [0-9a-z]
-- Authen via header "x-api-key: <key>" pour /api/products/scrape
```

### 4.12 Table `support_tickets`

```sql
CREATE TABLE support_tickets (
  id           SERIAL PRIMARY KEY,
  frontend_id  VARCHAR(20) UNIQUE,
    -- Format "TKT-{6derniers digits timestamp}"
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email        VARCHAR(255) NOT NULL,
  -- Catégories exactes du frontend SupportPage
  category     VARCHAR(30) NOT NULL DEFAULT 'General',
    -- 'General' | 'Order Issue' | 'Payment' | 'Shipping'
    -- | 'Product Question' | 'Account' | 'Technical' | 'Other'
  subject      VARCHAR(255) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'open',
    -- 'open' | 'in_progress' | 'resolved' | 'closed'
  response     VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'responded' (affiché dans le tableau frontend)
  priority     VARCHAR(10) NOT NULL DEFAULT 'normal',
  assigned_to  INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
```

### 4.13 Table `support_messages`

```sql
CREATE TABLE support_messages (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  is_staff    BOOLEAN NOT NULL DEFAULT FALSE,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    -- Notes internes (staff only, fond jaune dans le dashboard)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.14 Table `wishlists` (Stash)

```sql
CREATE TABLE wishlists (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);
```

### 4.15 Table `notifications`

```sql
CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT DEFAULT '',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  link       VARCHAR(300) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read);
-- Seed 3 notifications hardcodées du Header
-- { text: 'Welcome! Browse our latest products.', time: 'Just now' }
-- { text: 'New arrivals in Accessories!',         time: '2h ago'  }
-- { text: 'Limited stock on Focus V Aeris Kit.',  time: '5h ago'  }
```

### 4.16 Table `news`

```sql
CREATE TABLE news (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(300) NOT NULL,
  slug          VARCHAR(300) UNIQUE NOT NULL,
  category      VARCHAR(100) DEFAULT '',
    -- "Products", "Giveaways", "Updates", "Rewards"
  excerpt       TEXT DEFAULT '',
  body          TEXT DEFAULT '',
  image_url     VARCHAR(500),
    -- Peut être NULL (placeholder emoji dans le frontend)
  tag           VARCHAR(50) DEFAULT '',
    -- ex: "New", "Hot", "Update", "Event", "Maintenance"
  tag_color     VARCHAR(20) DEFAULT '#607d8b',
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,
  author_id     INTEGER REFERENCES users(id),
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.17 Table `giveaways`

```sql
CREATE TABLE giveaways (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  badge       VARCHAR(50) DEFAULT '',
    -- ex: "🔥 HOT", "⚡ FLASH", "⭐ VIP"
  color       VARCHAR(255) DEFAULT '',
    -- Gradient CSS complet ex: "linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)"
  value       VARCHAR(50) DEFAULT '',
    -- ex: "$500+"
  description TEXT DEFAULT '',
  prizes      JSONB NOT NULL DEFAULT '[]',
    -- Array de strings: ["Focus V Aeris Kit + $100 store credit", ...]
  ends_at     TIMESTAMPTZ,
  max_entries INTEGER,
  entries_count INTEGER NOT NULL DEFAULT 0,
  winners_count INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE giveaway_entries (
  id          SERIAL PRIMARY KEY,
  giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (giveaway_id, user_id)
);
```

### 4.18 Table `faq`

```sql
CREATE TABLE faq (
  id         SERIAL PRIMARY KEY,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 10 entrées à seeder depuis FaqPage.jsx
```

### 4.19 Table `system_status`

```sql
CREATE TABLE system_status (
  id          SERIAL PRIMARY KEY,
  service     VARCHAR(100) NOT NULL UNIQUE,
    -- 'Website' | 'API' | 'Payment Processing' | 'Order Management'
    -- | 'Search' | 'Shipping Integration' | 'Support System' | 'CDN / Media'
  description VARCHAR(255) DEFAULT '',
  status      VARCHAR(20) NOT NULL DEFAULT 'operational',
    -- 'operational' | 'degraded' | 'outage'
  uptime_pct  VARCHAR(10) DEFAULT '100%',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_incidents (
  id          SERIAL PRIMARY KEY,
  date_label  VARCHAR(50) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'resolved',
  description TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.20 Table `site_settings`

```sql
CREATE TABLE site_settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  type  VARCHAR(20) NOT NULL DEFAULT 'string'
);

INSERT INTO site_settings VALUES
  ('shipping_cost',           '16.99',  'number'),
  ('shipping_free_threshold', '75.00',  'number'),
    -- Seuil livraison gratuite (ShippingPolicyPage)
  ('shipping_deadline_h',     '22',     'number'),
    -- Heure limite expédition (22:39:04 dans Header)
  ('shipping_deadline_m',     '39',     'number'),
  ('points_rate',             '0.5',    'number'),
    -- 0.5 point par dollar dépensé
  ('deposit_expiry_hours',    '12',     'number'),
    -- Durée validité adresse dépôt (mentionnée dans les DEPOSIT_TERMS)
  ('site_name',               'Canna Express', 'string'),
  ('maintenance_mode',        'false',  'boolean');
```

---

## 5. API REST — Endpoints complets

### Conventions
- Base URL : `http://localhost:4000/api`
- Réponse : `{ success: true, data: ... }` ou `{ success: false, error: "message" }`
- Auth : Header `Authorization: Bearer <jwt_token>` (routes protégées)
- API publique : Header `x-api-key: <api_key>` (scrape endpoint)
- Pagination : `?page=1&limit=20`

---

### 5.1 Auth (`/api/auth`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/auth/register` | Non | Créer un compte |
| POST | `/auth/login` | Non | Se connecter |
| POST | `/auth/logout` | Oui | Se déconnecter |
| POST | `/auth/refresh` | Non | Rafraîchir le JWT |
| POST | `/auth/forgot-password` | Non | Demande réinitialisation mdp |
| POST | `/auth/reset-password` | Non | Réinitialiser le mdp |

**POST /auth/register**
```json
// Body
{ "username": "Jadevice55", "email": "user@example.com", "password": "SecurePass1!" }

// Réponse 201
{
  "data": {
    "user": { "id": 1, "username": "Jadevice55", "email": "...", "role": "customer" },
    "token": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**POST /auth/login**
```json
// Body
{ "email": "user@example.com", "password": "SecurePass1!" }

// Réponse 200
{ "data": { "user": { ... }, "token": "eyJ...", "refreshToken": "eyJ..." } }
```

---

### 5.2 Produits (`/api/products`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/products` | Non | Liste avec filtres/pagination |
| GET | `/products/scrape` | `x-api-key` | Scrape JSON (endpoint existant) |
| GET | `/products/:id` | Non | Détail produit |
| GET | `/products/:id/reviews` | Non | Avis d'un produit |
| POST | `/products/:id/reviews` | Oui | Poster un avis |
| POST | `/products` | Admin | Créer |
| PUT | `/products/:id` | Admin | Modifier |
| DELETE | `/products/:id` | Admin | Supprimer |
| PATCH | `/products/:id/stock` | Admin | Mettre à jour le stock |

**GET /products — Query params exacts**
```
?category=carts          → Filtre par slug catégorie (ou frontend_id)
?brand=Moxie             → Filtre par slug marque
?search=blue dream       → Recherche name + brand (case-insensitive)
?minPrice=5&maxPrice=50  → Fourchette de prix
?inStock=true            → Seulement stock > 0
?rating=4                → rating >= 4 (valeurs: 5, 4, 3)
?sort=price_asc          → price_asc | price_desc | name_asc | name_desc | rating_desc | newest | trending | bestselling
?page=1&limit=20         → Pagination
?featured=true           → is_featured = true
?trending=true           → is_trending = true
?new=true                → is_new = true
?onSale=true             → is_on_sale = true
?bestSelling=true        → is_best_selling = true
?priceType=usd           → 'usd' | 'points'
```

**Réponse GET /products**
```json
{
  "data": {
    "products": [{
      "id": 1,
      "frontendId": 30001,
      "name": "Blue Dream Cart 1g",
      "slug": "blue-dream-cart-1g",
      "price": 34.99,
      "priceType": "usd",
      "stock": 42,
      "rating": 4.7,
      "reviewCount": 88,
      "optionsCount": null,
      "imageUrl": "https://chadsflooring.bz/...",
      "brand": { "id": 1, "name": "Moxie", "slug": "Moxie" },
      "category": { "id": 3, "frontendId": "1", "label": "Carts", "slug": "carts" }
    }],
    "pagination": { "total": 85, "page": 1, "limit": 20, "totalPages": 5 }
  }
}
```

---

### 5.3 Catégories (`/api/categories`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/categories` | Non | Toutes les catégories actives |
| GET | `/categories/:slug` | Non | Détail catégorie |
| POST | `/categories` | Admin | Créer |
| PUT | `/categories/:id` | Admin | Modifier |
| DELETE | `/categories/:id` | Admin | Supprimer |

---

### 5.4 Marques (`/api/brands`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/brands` | Non | Toutes les marques |
| GET | `/brands?featured=true` | Non | Marques vedettes (Explore page) |
| POST | `/brands` | Admin | Créer |
| PUT | `/brands/:id` | Admin | Modifier |
| DELETE | `/brands/:id` | Admin | Supprimer |

---

### 5.5 Commandes (`/api/orders`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/orders` | Oui | Passer une commande |
| GET | `/orders` | Oui | Historique utilisateur |
| GET | `/orders/:id` | Oui | Détail commande |
| PATCH | `/orders/:id/cancel` | Oui | Annuler |
| GET | `/admin/orders` | Admin | Toutes les commandes |
| PATCH | `/admin/orders/:id/status` | Admin | Changer statut |
| PATCH | `/admin/orders/:id/tracking` | Admin | Ajouter tracking |

**POST /orders — Body exact**
```json
{
  "items": [
    { "productId": 1, "optionId": null, "quantity": 2 },
    { "productId": 5, "optionId": 3,    "quantity": 1 }
  ],
  "paymentMethod": "XMR",
  "shipping": {
    "name":    "John Doe",
    "email":   "john@example.com",
    "address": "123 Main St",
    "city":    "Los Angeles",
    "postal":  "90001",
    "country": "US"
  }
}
```

**Pays supportés** (depuis CheckoutPage) : US, CA, UK, AU, DE, FR, Other

**Réponse POST /orders 201**
```json
{
  "data": {
    "order": {
      "id": "ORD-1717934400000",
      "status": "processing",
      "subtotal": 69.98,
      "shippingCost": 16.99,
      "total": 86.97,
      "pointsEarned": 34,
      "placedAt": "2026-06-09T14:30:00Z"
    },
    "newBalance": 292.95
  }
}
```

**Statuts de commande** (couleurs affichées dans OrdersPage) :
```javascript
Processing: '#2196f3'
Shipped:    '#ff9800'
Delivered:  '#43a047'
Cancelled:  '#e53935'
```

---

### 5.6 Wallet (`/api/wallet`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/wallet` | Oui | Solde + infos |
| GET | `/wallet/transactions` | Oui | Historique (filtrable type=deposit/purchase) |
| POST | `/wallet/deposit` | Oui | Créer un dépôt |
| GET | `/wallet/deposits` | Oui | Liste dépôts (onglet "Credit Deposits") |
| GET | `/wallet/deposits/:id` | Oui | Détail dépôt (bouton "View") |

**GET /wallet**
```json
{
  "data": {
    "balance": 379.92,
    "points": 245,
    "tier": "basic",
    "cashbackRate": 0.005,
    "totalSpent": 490.00,
    "nextTier": "preferred",
    "nextTierAt": 1000.00,
    "remaining": 510.00,
    "daysLeft": 24
  }
}
```

**GET /wallet/transactions**
```json
{
  "data": {
    "transactions": [{
      "id": "TXN-1714800000",
      "type": "deposit",
      "amount": 500.00,
      "currency": "XMR",
      "date": "2026-04-14T10:30:00Z",
      "status": "confirmed",
      "note": "Initial deposit"
    }]
  }
}
```

**GET /wallet/deposits** (onglet "Credit Deposits" — colonnes exactes)
```json
{
  "data": {
    "deposits": [{
      "id": 1,
      "shortId": "12345678",  // 8 derniers chars (affiché dans "Id")
      "status": "confirmed",
      "currency": "BTC",
      "address": "bc1q...",   // affichée tronquée "bc1qxy2kgdygj…"
      "createdAt": "2026-06-09T..."
    }]
  }
}
```

**POST /wallet/deposit**
```json
// Body
{ "currency": "XMR" }
// (L'utilisateur ne spécifie pas de montant, il envoie ce qu'il veut)

// Réponse 201
{
  "data": {
    "depositId": 12,
    "address": "47rVkEn7ZeFXXX...",
    "currency": "XMR",
    "expiresAt": "2026-06-10T02:30:00Z"  // NOW() + 12h
  }
}
```

**DEPOSIT_TERMS à accepter** (10 conditions — affichées avant création) :
1. Âge minimum 21 ans
2. Envoyer n'importe quel montant à l'adresse affichée
3. Crédit basé sur le taux de change au moment de la confirmation blockchain
4. Crédité en USD au moment de la confirmation
5. $50 en BTC = $50 de store credit
6. Si aucune transaction reçue après 12 heures → dépôt annulé
7. Ne pas réutiliser les adresses de dépôt
8. Dépôts supplémentaires perdus définitivement
9. Ne pas envoyer sur une adresse de dépôt annulée
10. Fonds envoyés à une adresse annulée → perdus définitivement

---

### 5.7 Profil (`/api/profile`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/profile` | Oui | Profil complet |
| PUT | `/profile` | Oui | Mettre à jour |
| POST | `/profile/avatar` | Oui | Upload avatar |
| PUT | `/profile/password` | Oui | Changer le mdp |
| GET | `/profile/2fa` | Oui | Statut 2FA |
| POST | `/profile/2fa/enable` | Oui | Activer 2FA |
| POST | `/profile/2fa/disable` | Oui | Désactiver 2FA |
| GET | `/profile/notifications` | Oui | Paramètres notifs |
| PUT | `/profile/notifications` | Oui | Mettre à jour notifs |

**PUT /profile — Champs éditables**
```json
{
  "username": "string",
  "signalDetails": "string",
  "sessionDetails": "string",
  "btcRefundAddress": "string",
  "xmrRefundAddress": "string",
  "telegramHandle": "string"
}
```

**PUT /profile/password — Validation exacte du frontend**
```javascript
// SettingsPage.jsx — checkPassword()
{
  notEmpty:   password.length > 0,
  noSpaces:   !password.includes(' '),
  minLength:  password.length >= 8,
  hasSymbol:  /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  hasNumber:  /\d/.test(password),
  hasUpper:   /[A-Z]/.test(password),
  hasLower:   /[a-z]/.test(password),
}
// Score minimum pour accepter: 5/7 (frontend: pwScore < 5 = refus)
```

**PUT /profile/notifications**
```json
{
  "notifOrders":      boolean,
  "notifDeposits":    boolean,
  "notifTickets":     boolean,
  "notifNewProducts": boolean,
  "notifLogins":      boolean
}
```

---

### 5.8 Clés API (`/api/api-keys`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api-keys` | Oui | Lister les clés |
| POST | `/api-keys` | Oui | Générer une nouvelle clé |
| DELETE | `/api-keys/:id` | Oui | Supprimer |

**Format clé** : `sk-` + 32 chars `[0-9a-z]`

**POST /api-keys — Réponse 201 (clé affichée UNE SEULE FOIS)**
```json
{
  "data": {
    "id": 1,
    "prefix": "sk-abc1",
    "key": "sk-abc1xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "label": "Default Key",
    "createdAt": "2026-06-09T..."
  }
}
```

**GET /products/scrape — Auth via `x-api-key`**
```
curl -H "x-api-key: sk-abc1xxx..." http://localhost:4000/api/products/scrape
```

---

### 5.9 Wishlist / Stash (`/api/wishlist`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/wishlist` | Oui | Tous les produits stashés |
| POST | `/wishlist/:productId` | Oui | Ajouter (toggle) |
| DELETE | `/wishlist/:productId` | Oui | Retirer |

**Note** : Le frontend utilise un Set d'IDs numériques (`wishedIds`). La réponse doit retourner les IDs pour initialiser le Set.

---

### 5.10 Support (`/api/support`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/support/tickets` | Oui | Tickets utilisateur |
| POST | `/support/tickets` | Optionel* | Créer un ticket |
| GET | `/support/tickets/:id` | Oui | Détail + messages |
| POST | `/support/tickets/:id/messages` | Oui | Répondre |
| PATCH | `/support/tickets/:id/close` | Oui | Fermer |

*Un email est requis même sans compte (pour le widget flottant)

**POST /support/tickets — Champs exacts**
```json
{
  "email":    "user@example.com",
  "category": "Order Issue",
  "subject":  "My order hasn't arrived",
  "message":  "I placed order ORD-123..."
}
```

**Validation frontend** :
- email : requis + contient "@"
- subject : requis (non vide)
- message : >= 10 caractères

**Réponse 201 — Format ticket affiché dans le tableau**
```json
{
  "data": {
    "ticket": {
      "id": "TKT-934400",
      "type": "Order Issue",
      "status": "open",
      "response": "pending",
      "created": "Jun 9, 2026",
      "subject": "My order hasn't arrived"
    }
  }
}
```

**Colonnes du tableau SupportPage** : Type, Support ticket #, Status, Response, Created

---

### 5.11 Notifications (`/api/notifications`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/notifications` | Oui | Toutes les notifs |
| PATCH | `/notifications/:id/read` | Oui | Marquer lue |
| PATCH | `/notifications/read-all` | Oui | Tout marquer lu |

**Structure notif (correspond aux 3 hardcodées dans Header)** :
```json
{ "id": 1, "text": "Welcome! Browse our latest products.", "time": "Just now", "isRead": false }
```

---

### 5.12 Contenu public (`/api/content`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/content/news` | Non | Articles de news |
| GET | `/content/faq` | Non | 10 Q&A |
| GET | `/content/giveaways` | Non | Giveaways actifs |
| POST | `/content/giveaways/:id/enter` | Oui | Participer |
| GET | `/content/system-status` | Non | Statut + incidents |
| GET | `/content/shipping-policy` | Non | Paramètres livraison |
| GET | `/content/settings` | Non | Settings publics (shipping_cost, etc.) |

**GET /content/giveaways — Structure**
```json
{
  "data": {
    "giveaways": [{
      "id": 1,
      "title": "Summer 2026 Mega Giveaway",
      "badge": "🔥 HOT",
      "color": "linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)",
      "value": "$500+",
      "description": "...",
      "prizes": ["Focus V Aeris Kit + $100 store credit", "..."],
      "endDate": "2026-08-31T23:59:59Z",
      "entries": 3842,
      "winners": 3,
      "userEntered": false
    }]
  }
}
```

---

### 5.13 Routes Admin (`/api/admin`)

> Toutes les routes admin nécessitent `role = 'admin'`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/admin/dashboard` | KPIs + stats |
| GET | `/admin/analytics` | Données analytiques |
| GET | `/admin/users` | Liste utilisateurs |
| GET | `/admin/users/:id` | Détail utilisateur |
| PUT | `/admin/users/:id` | Modifier |
| PATCH | `/admin/users/:id/ban` | Bannir/Débannir |
| POST | `/admin/users/:id/wallet/adjust` | Ajustement manuel solde |
| GET | `/admin/orders` | Toutes les commandes |
| PATCH | `/admin/orders/:id/status` | Changer statut |
| PATCH | `/admin/orders/:id/tracking` | Ajouter tracking |
| GET | `/admin/products` | Tous les produits |
| POST | `/admin/products` | Créer |
| PUT | `/admin/products/:id` | Modifier |
| DELETE | `/admin/products/:id` | Supprimer |
| GET | `/admin/categories` | Toutes |
| POST | `/admin/categories` | Créer |
| PUT | `/admin/categories/:id` | Modifier |
| DELETE | `/admin/categories/:id` | Supprimer |
| GET | `/admin/brands` | Toutes |
| POST | `/admin/brands` | Créer |
| PUT | `/admin/brands/:id` | Modifier |
| DELETE | `/admin/brands/:id` | Supprimer |
| GET | `/admin/transactions` | Toutes les transactions |
| GET | `/admin/deposits` | Tous les dépôts |
| PATCH | `/admin/deposits/:id/confirm` | Confirmer manuellement |
| PATCH | `/admin/deposits/:id/expire` | Expirer |
| GET | `/admin/support/tickets` | Tous les tickets |
| POST | `/admin/support/tickets/:id/messages` | Répondre |
| PATCH | `/admin/support/tickets/:id/status` | Changer statut |
| PATCH | `/admin/support/tickets/:id/assign` | Assigner |
| PATCH | `/admin/support/tickets/:id/priority` | Changer priorité |
| GET | `/admin/news` | Articles |
| POST | `/admin/news` | Créer |
| PUT | `/admin/news/:id` | Modifier |
| DELETE | `/admin/news/:id` | Supprimer |
| GET | `/admin/giveaways` | Giveaways |
| POST | `/admin/giveaways` | Créer |
| PUT | `/admin/giveaways/:id` | Modifier |
| DELETE | `/admin/giveaways/:id` | Supprimer |
| GET | `/admin/giveaways/:id/entries` | Participants |
| GET | `/admin/faq` | FAQ |
| POST | `/admin/faq` | Créer Q&A |
| PUT | `/admin/faq/:id` | Modifier |
| DELETE | `/admin/faq/:id` | Supprimer |
| PUT | `/admin/faq/reorder` | Réordonner |
| GET | `/admin/system-status` | Statut services |
| PUT | `/admin/system-status/:id` | Modifier statut service |
| POST | `/admin/system-status/incidents` | Ajouter incident |
| GET | `/admin/reviews` | Tous les avis (modération) |
| PATCH | `/admin/reviews/:id/approve` | Approuver |
| DELETE | `/admin/reviews/:id` | Supprimer |
| GET | `/admin/settings` | Paramètres site |
| PUT | `/admin/settings` | Modifier |

---

## 6. Logique métier backend

### 6.1 Calcul commande (résolution de l'incohérence shipping)

```javascript
// Règle canonique à appliquer côté backend
const SHIPPING_COST = 16.99;      // CartPage (correct)
const FREE_SHIPPING_THRESHOLD = 75.00; // ShippingPolicyPage

async function calculateOrder(items) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  return { subtotal, shippingCost, total: subtotal + shippingCost };
}
```

### 6.2 Création commande — transaction atomique

```javascript
async function placeOrder(userId, items, shipping, paymentMethod) {
  const user = await getUserById(userId);
  const { subtotal, shippingCost, total } = await calculateOrder(items);

  // Vérifications préalables
  if (user.balance < total) throw new Error('Insufficient balance');
  for (const item of items) {
    const product = await getProductById(item.productId);
    if (product.stock < item.quantity) throw new Error(`Out of stock: ${product.name}`);
  }

  await db.transaction(async (trx) => {
    // 1. Créer la commande
    const order = await createOrder(trx, {
      userId, subtotal, shippingCost, total,
      paymentMethod, shipping, status: 'processing'
    });

    // 2. Créer les order_items (avec snapshot des données produit)
    await createOrderItems(trx, order.id, items);

    // 3. Décrémenter le stock
    await decrementStocks(trx, items);

    // 4. Débiter le wallet
    await debitBalance(trx, userId, total);

    // 5. Calculer et ajouter les points
    const pointsEarned = Math.floor(subtotal * 0.5); // 0.5 pt par $ de subtotal
    await addPoints(trx, userId, pointsEarned, subtotal);

    // 6. Créer la transaction wallet
    await createTransaction(trx, {
      userId, orderId: order.id, type: 'purchase',
      amount: -total, currency: 'USD', status: 'confirmed',
      note: `Order ${order.frontendId}`
    });

    // 7. Mettre à jour total_spent → vérifier upgrade tier
    await updateTotalSpent(trx, userId, subtotal);

    return order;
  });
}
```

### 6.3 Système de tiers — valeurs exactes

```javascript
const TIERS = [
  { name: 'basic',     minSpent: 0,     maxSpent: 999,    cashback: 0.005, color: '#2E7D5B' },
  { name: 'preferred', minSpent: 1000,  maxSpent: 1999,   cashback: 0.010, color: '#2F6FB0' },
  { name: 'gold',      minSpent: 2000,  maxSpent: 4999,   cashback: 0.013, color: '#D4A843' },
  { name: 'platinum',  minSpent: 5000,  maxSpent: 19999,  cashback: 0.015, color: '#E8E4DA' },
];

function getUserTier(totalSpent) {
  return [...TIERS].reverse().find(t => totalSpent >= t.minSpent) || TIERS[0];
}

// RewardsPage affiche:
// - "X days left" → jours restants avant fin du mois
// - "remaining until next tier" = goal - spent (goal = seuil du prochain tier)
```

### 6.4 Affichage stock — logique exacte

```javascript
// ProductCard.jsx ligne 26-28
const isLowStock = product.stock > 0 && product.stock <= 10;
const inStock = product.stock > 0;
const stockLabel = product.stock >= 250 ? '250+ left' : `${product.stock} left`;

// stock: 999 = illimité (affiché comme "250+ left")
// stock: 0 = "Out of stock" + bouton désactivé
// stock: 1-10 = isLowStock = true (rouge)
// stock: 11-249 = normal
// stock: 250+ = "250+ left"
```

### 6.5 Génération clé API

```javascript
// Format exact du frontend (SettingsPage.jsx ligne 114-117)
const key = 'sk-' + Array.from({ length: 32 }, () =>
  '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]
).join('');
// Stocker: bcrypt(key) + prefix = key.substring(0, 6)
```

### 6.6 Compte à rebours shipping (Header)

```javascript
// Header.jsx — countdown depuis une heure fixe
// Le frontend hardcode 22h 39m 4s comme point de départ
// Le backend devrait exposer l'heure limite via GET /content/settings

// shipping_deadline_h = 22, shipping_deadline_m = 0 (configurable)
function getNextShippingDeadline(deadlineH, deadlineM) {
  const now = new Date();
  const deadline = new Date();
  deadline.setHours(deadlineH, deadlineM, 0, 0);
  if (now >= deadline) deadline.setDate(deadline.getDate() + 1);
  return deadline;
}
```

### 6.7 Tour d'accueil (Layout)

Le frontend affiche un tour de 9 étapes sur la ShopPage. Le backend peut persister si l'utilisateur l'a déjà vu :
```sql
ALTER TABLE users ADD COLUMN tour_completed BOOLEAN NOT NULL DEFAULT FALSE;
```
Endpoint : `PATCH /profile/tour-complete`

### 6.8 Logique dépôt wallet

```javascript
// Durée de validité : 12 heures (mentionné dans DEPOSIT_TERMS point 6)
// La page WalletPage montre:
// - Onglet 0 "Credit Deposits" → tableau des dépôts
// - Onglet 1 "Credit History" → vide (transactions non-dépôt)
// - Onglet 2 "Legacy Credit History" → vide
// Le bouton "View" dans le tableau → GET /wallet/deposits/:id (modal ou page détail)
```

---

## 7. Authentification & Sécurité

### 7.1 JWT Strategy

```javascript
const ACCESS_TOKEN_EXPIRY  = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Payload du token
{
  "sub":   42,             // userId
  "email": "...",
  "role":  "customer",     // 'customer' | 'admin' | 'moderator'
  "iat":   1234567890,
  "exp":   1234568790
}
```

### 7.2 Middlewares

```javascript
// middlewares/auth.js
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Unauthenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ success: false, error: 'Admin access required' });
  next();
}

// Middleware API key (pour /api/products/scrape)
async function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ success: false, error: 'API key required' });
  const apiKey = await findApiKeyByPrefix(key);
  if (!apiKey || !await bcrypt.compare(key, apiKey.keyHash))
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  await updateLastUsed(apiKey.id);
  next();
}
```

### 7.3 Rate limiting

```javascript
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);
```

---

## 8. Architecture des fichiers Express

```
backend/
├── .env
├── package.json
├── server.js                   # Point d'entrée
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app.js                  # Config Express + middlewares
│   ├── db.js                   # Client PostgreSQL / Prisma
│   │
│   ├── middlewares/
│   │   ├── auth.js             # requireAuth, requireAdmin, requireApiKey
│   │   ├── validate.js         # Validation Zod/Joi
│   │   ├── upload.js           # Multer (avatars, images produits)
│   │   └── errorHandler.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── products.routes.js  # Inclut /scrape avec x-api-key
│   │   ├── categories.routes.js
│   │   ├── brands.routes.js
│   │   ├── orders.routes.js
│   │   ├── wallet.routes.js    # Dépôts BTC/DOGE/LTC/XMR
│   │   ├── profile.routes.js
│   │   ├── apiKeys.routes.js
│   │   ├── wishlist.routes.js
│   │   ├── support.routes.js
│   │   ├── notifications.routes.js
│   │   ├── content.routes.js   # news, faq, giveaways, system-status
│   │   └── admin/
│   │       ├── index.js
│   │       ├── dashboard.routes.js
│   │       ├── analytics.routes.js
│   │       ├── users.routes.js
│   │       ├── orders.routes.js
│   │       ├── products.routes.js
│   │       ├── categories.routes.js
│   │       ├── brands.routes.js
│   │       ├── transactions.routes.js
│   │       ├── deposits.routes.js
│   │       ├── support.routes.js
│   │       ├── reviews.routes.js
│   │       ├── content.routes.js
│   │       ├── systemStatus.routes.js
│   │       └── settings.routes.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── products.controller.js
│   │   ├── orders.controller.js
│   │   ├── wallet.controller.js
│   │   ├── profile.controller.js
│   │   ├── support.controller.js
│   │   ├── content.controller.js
│   │   └── admin/
│   │       └── ...
│   │
│   ├── services/
│   │   ├── auth.service.js       # JWT, bcrypt, 2FA
│   │   ├── order.service.js      # Transaction atomique, stock, points
│   │   ├── wallet.service.js     # Dépôts, transactions
│   │   ├── points.service.js     # Calcul points (0.5 pt/$ subtotal), tiers
│   │   ├── shipping.service.js   # Calcul frais (free si > $75, sinon $16.99)
│   │   ├── crypto.service.js     # Génération adresses crypto
│   │   ├── apiKey.service.js     # Génération/validation clés API
│   │   ├── mail.service.js       # Emails transactionnels
│   │   └── notification.service.js
│   │
│   ├── validators/
│   │   ├── auth.validator.js     # Règles mdp exactes du frontend
│   │   ├── order.validator.js    # Pays: US, CA, UK, AU, DE, FR, Other
│   │   ├── product.validator.js
│   │   └── support.validator.js  # message >= 10 chars
│   │
│   └── utils/
│       ├── formatters.js         # formatOrderId, formatTxnId, formatTicketId
│       ├── pagination.js
│       └── apiResponse.js
│
└── uploads/
```

### Variables d'environnement (`.env`)

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://user:password@localhost:5432/canna_express

JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

FRONTEND_URL=http://localhost:3000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# CDN images produits (actuel)
CDN_BASE_URL=https://chadsflooring.bz
BRAND_IMAGES_URL=https://chadsflooring.bz/assets/images/brands/industry-brands/
PRODUCT_IMAGES_URL=https://chadsflooring.bz/uploads/products/
```

---

## 9. Dashboard Admin — Spécifications complètes

### 9.1 Layout Admin

```
┌──────────────────────────────────────────────────────────────────┐
│  [Logo] CANNA EXPRESS ADMIN              [Notifs] [Avatar] [↪]  │  ← Header
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                        │
│ Sidebar  │              Zone de contenu                          │
│          │                                                        │
│ Dashboard                                                         │
│ Commandes                                                         │
│ Produits                                                          │
│ Catégories                                                        │
│ Marques                                                           │
│ Utilisateurs                                                      │
│ Transactions                                                      │
│ Dépôts                                                            │
│ Support                                                           │
│ ─────────                                                         │
│ Contenu                                                           │
│  ├ News                                                           │
│  ├ FAQ                                                            │
│  ├ Giveaways                                                      │
│  └ Shipping Policy                                                │
│ ─────────                                                         │
│ Avis (modération)                                                 │
│ Analytiques                                                       │
│ ─────────                                                         │
│ Statut système                                                    │
│ Paramètres                                                        │
│                                                                   │
└──────────┴───────────────────────────────────────────────────────┘
```

---

### 9.2 Page Dashboard

**KPI Cards (top)**
| Card | Description | Couleur |
|------|-------------|---------|
| Revenus du jour | + variation % vs hier | Vert |
| Commandes en attente | status=processing | Bleu (#2196f3) |
| Nouveaux utilisateurs | inscrits aujourd'hui | Violet |
| Tickets ouverts | ouverts + urgents | Orange |
| Produits en rupture | stock = 0 | Rouge |

**Graphiques**
- Revenus sur 30 jours (line chart)
- Commandes par statut : Processing/Shipped/Delivered/Cancelled avec couleurs exactes (#2196f3/#ff9800/#43a047/#e53935) (donut)
- Top 5 produits vendus (bar chart horizontal)
- Nouveaux utilisateurs sur 7 jours (bar chart)

**Tables**
- 10 dernières commandes (ID, client, total, statut coloré, date)
- Produits stock <= 10 (low stock alert)
- 5 tickets récents non assignés

---

### 9.3 Page Commandes

**Filtres**
- Statut : All | Processing | Shipped | Delivered | Cancelled
- Méthode paiement : All | XMR | BTC | ETH
- Période : Aujourd'hui / 7j / 30j / Custom
- Recherche : ID commande ou email client

**Tableau**
| Colonne | Tri | Détail |
|---------|-----|--------|
| ID (ORD-xxx) | Non | Lien vers détail |
| Client | Non | Nom + email |
| Articles | Non | N article(s) |
| Total | Oui | $XX.XX |
| Paiement | Non | Badge XMR/BTC/ETH |
| Statut | Non | Badge coloré exact |
| Date | Oui | DD/MM/YYYY |
| Actions | Non | Voir, Changer statut, Tracking |

**Page détail commande**
- Info client complètes + adresse livraison
- Articles avec image, marque, nom, prix unitaire, quantité, total ligne
- Résumé : subtotal + shipping + total
- Timeline statut avec bouton changement
- Champ tracking number
- Boutons : Annuler, Rembourser

---

### 9.4 Page Produits

**Filtres**
- Catégorie (toutes les 12, par label exact du frontend)
- Marque (toutes les marques)
- Stock : All | In Stock | Low Stock (≤10) | Out of Stock
- Type de prix : All | USD | Points
- Statut : All | Active | Inactive
- Recherche texte

**Tableau**
| Colonne | Tri |
|---------|-----|
| Image | Non |
| Nom + Slug | Oui |
| Marque (slug) | Oui |
| Catégorie | Non |
| Prix | Oui |
| Type (USD/Points) | Non |
| Stock | Oui |
| Options | Non |
| Rating + count | Oui |
| Drapeaux (trending/new/sale/bestselling) | Non |
| Statut | Non |
| Actions | Non |

**Formulaire produit**
```
Général:
  - Nom, Slug (auto), Description
  - Catégorie (dropdown — IDs frontend exacts)
  - Marque (dropdown ou créer)
  - Statut : Actif/Inactif
  - Drapeaux : Featured, Trending, New, On Sale, Best Selling
  - Sort order

Prix & Stock:
  - Prix ($)
  - Type : USD | Points
  - Stock actuel

Options (si plusieurs variantes):
  - Ajouter des lignes : Label, Prix delta, Stock
  - Réordonnable

Images:
  - Upload image principale (Multer)
  - URL externe (alternative)
```

---

### 9.5 Page Catégories

**Tableau**
- Label, Slug, frontend_id, Nb produits, Sort order, Featured, Actif
- Édition inline ou modale
- Drag & drop pour réordonner (met à jour sort_order)

---

### 9.6 Page Marques

**Tableau**
- Nom, Slug, Logo, Nb produits, Featured (Explore), Actif
- Actions : Éditer, Supprimer

**Formulaire marque**
- Nom, Slug, Logo URL ou upload, Website URL, Description, Featured, Actif

---

### 9.7 Page Utilisateurs

**Filtres**
- Rôle : All | Customer | Admin | Moderator
- Statut : All | Active | Banned
- Tier : All | Basic | Preferred | Gold | Platinum
- Recherche : username ou email

**Tableau**
| Colonne | Tri |
|---------|-----|
| ID | Oui |
| Username + Email | Non |
| Rôle | Non |
| Tier (coloré) | Oui |
| Balance | Oui |
| Total dépensé | Oui |
| Points | Oui |
| Nb commandes | Oui |
| Inscrit le | Oui |
| Dernier login | Oui |
| Statut | Non |
| Actions | Non |

**Page détail utilisateur**
- Infos profil complètes (username, email, Signal, Session, BTC/XMR refund, Telegram)
- Wallet : balance, points, tier, total_spent + bouton "Ajustement manuel"
- Commandes (tableau compact)
- Transactions (tableau avec types)
- Dépôts
- Tickets support
- Clés API (avec bouton révoquer)
- Boutons admin : Changer rôle, Bannir/Débannir, Reset password

**Modal ajustement de solde**
```
Type: Crédit | Débit
Montant: $___
Raison: _______________ (requis)
```
→ Crée une transaction de type 'adjustment' en DB

---

### 9.8 Page Transactions

**Filtres**
- Type : All | Deposit | Purchase | Refund | Adjustment
- Statut : All | Pending | Confirmed | Failed | Cancelled
- Devise : All | USD | XMR | BTC | ETH | DOGE | LTC
- Période + Recherche ID ou email

**Tableau**
| Colonne |
|---------|
| ID (TXN-xxx) |
| Utilisateur |
| Type (badge) |
| Montant (+ vert / − rouge) |
| Devise |
| Statut |
| Note |
| Lié à (commande ORD-xxx) |
| Date |

---

### 9.9 Page Dépôts

**Tableau** (correspond aux colonnes WalletPage: Id, Status, Currency, Address, Created, Details)

| Colonne |
|---------|
| ID court (8 chars) |
| Utilisateur |
| Devise (BTC/DOGE/LTC/XMR) |
| Adresse (tronquée) |
| Montant attendu |
| Montant reçu |
| USD crédité |
| Statut (awaiting/partial/confirmed/expired) |
| Expire le |
| Créé le |
| Actions |

**Actions par dépôt**
- "Confirmer manuellement" → confirme le dépôt, crédite le wallet
- "Expirer" → force l'expiration
- "Voir adresse complète"
- Lien explorateur blockchain

---

### 9.10 Page Support

**Vue globale** : Stats par statut (Open/In Progress/Resolved/Closed)

**Tableau tickets**
| Colonne |
|---------|
| ID (TKT-xxxxxx) |
| Type (category exacte: General, Order Issue, Payment...) |
| Utilisateur + email |
| Sujet |
| Statut (open/in_progress/resolved/closed) |
| Response (pending/responded) |
| Priorité |
| Assigné à |
| Créé le |
| Dernière réponse |
| Actions |

**Page détail ticket**
- En-tête : ID, catégorie, statut, priorité, assigné à
- Dropdowns de changement : statut, priorité, assignation (liste admins/modos)
- **Fil de messages** (style chat) :
  - Messages client → bulle gauche
  - Réponses staff → bulle droite (bleu)
  - Notes internes → fond jaune (staff only)
  - Horodatage sur chaque message
- Textarea de réponse + choix : Réponse publique / Note interne
- Bouton "Envoyer"

---

### 9.11 Contenu — News

- Tableau des articles avec statut published/draft
- Colonnes : Titre, Catégorie, Tag (coloré), Image, Date publication, Statut
- **Formulaire** : titre, slug, catégorie, excerpt, body, image URL/upload, tag, tag_color, publier
- Actions : Publier/Dépublier, Supprimer

---

### 9.12 Contenu — FAQ

- 10 Q&A actuellement hardcodées
- Drag & drop pour réordonner (sort_order)
- Édition inline ou modale

---

### 9.13 Contenu — Giveaways

- Tableau : titre, badge, valeur, entrées, gagnants, fin le, statut
- **Formulaire** : titre, badge, color (gradient picker), value, description, prizes (liste dynamique), ends_at, winners_count
- Voir les participants (tableau avec username + date entrée)

---

### 9.14 Contenu — Statut système

- Tableau des 8 services (service, description, statut dropdown, uptime %)
- Section incidents : titre, date, statut, description (ajout manuel)

---

### 9.15 Avis (modération)

**Tableau**
- Produit, Utilisateur, Note (★), Titre, Extrait, Statut (pending/approved), Date

**Actions**
- Approuver (is_approved = true → recalcule rating produit)
- Refuser / Supprimer

---

### 9.16 Analytiques

**Métriques**
- Revenus par période (day/week/month/year) — line chart
- Commandes par statut — donut (couleurs exactes frontend)
- Revenus par méthode paiement (XMR vs BTC vs ETH) — bar
- Top produits par revenus ET par quantité — tableaux
- Top catégories — bar
- Nouveaux utilisateurs par période — line
- Dépôts par devise (BTC/DOGE/LTC/XMR) — donut
- Flux wallet (dépôts vs achats) — area chart

---

### 9.17 Paramètres

```
Général:
  - Nom du site
  - Mode maintenance (toggle)

Shipping:
  - Coût livraison ($) → site_settings 'shipping_cost'
  - Seuil livraison gratuite ($) → 'shipping_free_threshold'
  - Heure limite expédition (HH:MM) → 'shipping_deadline_h' + 'm'

Fidélité:
  - Points par dollar (taux) → 'points_rate'
  - Seuils tiers (Basic/Preferred/Gold/Platinum)
  - Cashback tiers

Dépôts:
  - Durée validité adresse (heures) → 'deposit_expiry_hours'

Email/Telegram:
  - Config SMTP
  - QR Telegram bot
```

---

## 10. Intégration Frontend → Backend

### 10.1 Modifications `AppContext.jsx`

```javascript
// Remplacer les données statiques par des appels API
// Balance initiale: 379.92 → GET /wallet
// Transactions initiales (4 hardcodées) → GET /wallet/transactions
// Profile (Guest User) → GET /profile
// Products (allProducts import) → GET /products
// Orders (vide) → GET /orders
// ApiKey (sk-live-xxx) → GET /api-keys

const [loading, setLoading] = useState(true);

useEffect(() => {
  // Si token présent en localStorage → charger les données user
  const token = localStorage.getItem('token');
  if (token) {
    Promise.all([
      api.get('/wallet'),
      api.get('/profile'),
      api.get('/orders'),
      api.get('/wishlist'),
      api.get('/api-keys'),
    ]).then(([wallet, profile, orders, wishlist, apiKeys]) => {
      setBalance(wallet.data.balance);
      setProfile(profile.data);
      setOrders(orders.data.orders);
      setWishedIds(new Set(wishlist.data.productIds));
      // ...
    });
  }
  // Products toujours chargés (pas besoin d'auth)
  api.get('/products').then(r => setProducts(r.data.products));
}, []);
```

### 10.2 Composants à modifier — liste exhaustive

| Composant | Modification |
|-----------|-------------|
| `AppContext` | Remplacer toutes les données statiques + actions par appels API |
| `Header` | GET /notifications (3 hardcodées → API), countdown depuis GET /content/settings |
| `ShopPage` | GET /products avec filtres côté serveur + pagination |
| `ExplorePage` | GET /products?trending=true, ?new=true, ?onSale=true, ?category=carts&bestselling=true + GET /brands?featured=true |
| `ProductPage` | GET /products/:id (au lieu de `products.find()`) |
| `CartPage` | Panier persisté (localStorage + synchro API si connecté) |
| `CartDrawer` | Idem CartPage |
| `CheckoutPage` | POST /orders (vraie validation serveur) |
| `OrdersPage` | GET /orders depuis API |
| `ProfilePage` | GET /profile complet (Signal, Session, BTC/XMR, Telegram) + PUT /profile |
| `WalletPage` | GET /wallet, GET /wallet/deposits, GET /wallet/transactions, POST /wallet/deposit |
| `RewardsPage` | GET /wallet (balance, points, tier, totalSpent, remaining, daysLeft) |
| `SettingsPage` | PUT /profile/password, POST/DELETE /api-keys, PUT /profile/notifications, POST/DELETE /profile/2fa |
| `SupportPage` | GET/POST /support/tickets |
| `SupportWidget` | POST /support/tickets (sans auth requise) |
| `NewsPage` | GET /content/news |
| `GiveawayPage` | GET /content/giveaways, POST /content/giveaways/:id/enter |
| `FaqPage` | GET /content/faq |
| `SystemStatusPage` | GET /content/system-status |
| `AccountSidebar` | Bouton Logout → DELETE token + redirect |
| `CategoryNav` | GET /categories (ordre par sort_order) |
| `FilterPanel` | Marques depuis GET /brands (au lieu de computed du catalogue local) |

### 10.3 Route manquante à créer

`/team` → `TeamPage.jsx` — présente dans AccountSidebar mais non implémentée.
Le backend doit avoir une table `teams` ou simplement retourner une page statique.

### 10.4 Wrapper API avec JWT

```javascript
// src/utils/api.js
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) { logout(); return; }
    return apiCall(endpoint, options);
  }

  return res.json();
}
```

### 10.5 Variables d'environnement frontend

```env
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_CDN_URL=https://chadsflooring.bz
REACT_APP_BRAND_IMAGES_URL=https://chadsflooring.bz/assets/images/brands/industry-brands/
```

---

## 11. Plan d'implémentation priorisé

### Phase 1 — Fondations (Semaine 1-2)
- [ ] Init Express + PostgreSQL + Prisma
- [ ] Créer toutes les tables (migrations)
- [ ] Script seed : 85 produits, 12 catégories, 23 marques depuis `products.js`
- [ ] Seed 3 notifications Header, 10 FAQ, 6 news, 3 giveaways, 8 system services
- [ ] Auth : register, login, refresh token, logout
- [ ] Middlewares : requireAuth, requireAdmin, requireApiKey
- [ ] `GET /products` avec tous les filtres (search, category, brand, inStock, rating, maxPrice, sort)
- [ ] `GET /categories` + `GET /brands`
- [ ] Connecter le frontend : chargement produits depuis API

### Phase 2 — Utilisateurs & Panier (Semaine 3-4)
- [ ] `GET/PUT /profile` (tous les champs enrichis)
- [ ] `PUT /profile/password` (validation exacte du frontend)
- [ ] `GET/PUT /profile/notifications`
- [ ] `POST/GET/DELETE /api-keys` (avec `x-api-key` middleware)
- [ ] `GET/POST /wishlist/:productId`
- [ ] `POST /orders` (transaction atomique complète)
- [ ] `GET /orders` + `GET /orders/:id`
- [ ] `GET /wallet` (balance, tier, points)
- [ ] `GET /wallet/deposits` + `POST /wallet/deposit` (4 devises)
- [ ] `GET /wallet/transactions`
- [ ] `GET/POST /support/tickets`

### Phase 3 — Dashboard Admin (Semaine 5-6)
- [ ] Layout admin (sidebar, header)
- [ ] `GET /admin/dashboard` (KPIs avec vraies couleurs statuts)
- [ ] CRUD Produits complet (avec upload image)
- [ ] CRUD Catégories (avec drag & drop sort_order)
- [ ] CRUD Marques
- [ ] Gestion commandes (liste + détail + statut + tracking)
- [ ] Gestion utilisateurs (liste + détail + ajustement balance)

### Phase 4 — Admin avancé (Semaine 7-8)
- [ ] Transactions + Dépôts (confirmation manuelle)
- [ ] Support (vue tickets + messagerie staff + notes internes)
- [ ] Modération avis (approve/reject → recalcul rating)
- [ ] Contenu : News, FAQ (drag & drop), Giveaways
- [ ] Statut système (édition en ligne)
- [ ] Analytiques (graphiques Recharts)
- [ ] Paramètres site (shipping, tiers, etc.)

### Phase 5 — Production (Semaine 9-10)
- [ ] TeamPage (route /team manquante)
- [ ] Tour d'accueil persisté (tour_completed en DB)
- [ ] Tests unitaires + intégration (Jest + Supertest)
- [ ] Variables env production
- [ ] Déploiement (VPS + Nginx + PM2)
- [ ] SSL/HTTPS
- [ ] Backup PostgreSQL automatique
- [ ] Monitoring (logs morgan, alertes)

---

## Annexes

### A. Codes HTTP utilisés

| Code | Signification |
|------|--------------|
| 200 | OK |
| 201 | Créé avec succès |
| 400 | Requête invalide (validation) |
| 401 | Non authentifié |
| 403 | Accès refusé |
| 404 | Ressource non trouvée |
| 409 | Conflit (email déjà pris, déjà inscrit au giveaway) |
| 422 | Entité non processable (balance insuffisante, stock épuisé) |
| 429 | Rate limit atteint |
| 500 | Erreur serveur |

### B. Format des IDs frontend à préserver

| Entité | Format | Exemple |
|--------|--------|---------|
| Commande | `ORD-{Date.now()}` | `ORD-1717934400000` |
| Transaction | `TXN-{Date.now()}` | `TXN-1714800000` |
| Ticket | `TKT-{timestamp.slice(-6)}` | `TKT-934400` |

### C. Emails transactionnels

| Email | Déclencheur |
|-------|------------|
| Bienvenue | Après register |
| Confirmation commande | Après POST /orders |
| Commande expédiée | Statut → 'shipped' |
| Ticket créé | Après POST /support/tickets |
| Réponse staff ticket | Quand admin répond |
| Dépôt confirmé | Dépôt confirmé blockchain |
| Réinitialisation mdp | Forgot-password |
| Nouveau login | Si notif_logins = true (via Telegram) |
| Nouveau produit | Si notif_new_products = true (via Telegram) |

### D. Seed script priorités

```javascript
// Ordre d'exécution du seed
// 1. site_settings
// 2. categories (avec frontend_id exacts)
// 3. brands (avec slugs exacts du brandSlug frontend)
// 4. products (85 articles avec frontend_id, category via frontend_id, brand via slug)
// 5. product_options (pour les produits avec options != null)
// 6. system_status (8 services)
// 7. system_incidents (2 incidents)
// 8. news (6 articles)
// 9. giveaways (3 giveaways avec prizes en JSONB)
// 10. faq (10 Q&A)
// 11. Un user admin de test
// 12. 3 notifications de bienvenue (hardcodées du Header)
```

---

*Document généré le 2026-06-09 — Analyse exhaustive de tous les 34 fichiers source du frontend Canna Express Shop*
