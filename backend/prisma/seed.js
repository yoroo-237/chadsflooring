const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const usedSlugs = new Set();
function uniqueSlug(name, frontendId) {
  let slug = slugify(name);
  if (usedSlugs.has(slug)) slug = `${slug}-${frontendId}`;
  usedSlugs.add(slug);
  return slug;
}

function parsePrice(str) {
  if (str.startsWith('$')) return { price: parseFloat(str.slice(1)), priceType: 'usd' };
  if (str.startsWith('P')) return { price: parseInt(str.slice(1)),   priceType: 'points' };
  return { price: parseFloat(str), priceType: 'usd' };
}

const CDN = 'https://chadsflooring.bz/uploads/products/';

// ── Seed data ─────────────────────────────────────────────────────────────────

const SETTINGS = [
  { key: 'shipping_cost',           value: '16.99',         type: 'number'  },
  { key: 'shipping_free_threshold', value: '75.00',         type: 'number'  },
  { key: 'shipping_deadline_h',     value: '22',            type: 'number'  },
  { key: 'shipping_deadline_m',     value: '39',            type: 'number'  },
  { key: 'points_rate',             value: '0.5',           type: 'number'  },
  { key: 'deposit_expiry_hours',    value: '12',            type: 'number'  },
  { key: 'site_name',               value: 'Canna Express', type: 'string'  },
  { key: 'maintenance_mode',        value: 'false',         type: 'boolean' },
];

const CATEGORIES = [
  { frontendId: '4',  slug: 'accessories',  label: 'Accessories',  sortOrder: 1,  isFeatured: true  },
  { frontendId: '11', slug: 'byob',         label: 'BYOB',         sortOrder: 2,  isFeatured: true  },
  { frontendId: '1',  slug: 'carts',        label: 'Carts',        sortOrder: 3,  isFeatured: true  },
  { frontendId: '3',  slug: 'concentrates', label: 'Concentrates', sortOrder: 4,  isFeatured: true  },
  { frontendId: '6',  slug: 'disposables',  label: 'Disposables',  sortOrder: 5,  isFeatured: true  },
  { frontendId: '7',  slug: 'edibles',      label: 'Edibles',      sortOrder: 6,  isFeatured: true  },
  { frontendId: '2',  slug: 'flower',       label: 'Flower',       sortOrder: 7,  isFeatured: true  },
  { frontendId: '8',  slug: 'merch',        label: 'Merch',        sortOrder: 8,  isFeatured: false },
  { frontendId: '13', slug: 'munchies',     label: 'Munchies',     sortOrder: 9,  isFeatured: false },
  { frontendId: '9',  slug: 'pre-rolls',    label: 'Pre-rolls',    sortOrder: 10, isFeatured: true  },
  { frontendId: '10', slug: 'topical',      label: 'Topical',      sortOrder: 11, isFeatured: false },
  { frontendId: '-1', slug: 'rewards',      label: 'Rewards',      sortOrder: 12, isFeatured: false },
];

const BRANDS = [
  { name: 'Moxie',               slug: 'Moxie',           isFeatured: false },
  { name: 'Focus V',             slug: 'focusv',          isFeatured: false },
  { name: 'Maven Torch',         slug: 'Maven',           isFeatured: true  },
  { name: 'Santa Cruz Shredder', slug: 'santacruz',       isFeatured: false },
  { name: 'Cali Crusher',        slug: 'CaliCrusher',     isFeatured: false },
  { name: 'Formula 420',         slug: 'formula420',      isFeatured: false },
  { name: 'Raw',                 slug: 'raw',             isFeatured: false },
  { name: '710 Labs',            slug: '710Labs',         isFeatured: true  },
  { name: 'PlugPlay',            slug: 'PlugPlay',        isFeatured: false },
  { name: "Chad's",              slug: 'chads',           isFeatured: false },
  { name: 'Wyld',                slug: 'wyld',            isFeatured: false },
  { name: 'Kiva',                slug: 'kiva',            isFeatured: false },
  { name: 'Alien Labs',          slug: 'alienlabs',       isFeatured: true  },
  { name: 'Connected',           slug: 'connected',       isFeatured: false },
  { name: 'Jungle Boys',         slug: 'jungleboys',      isFeatured: false },
  { name: "Lay's",               slug: 'lays',            isFeatured: false },
  { name: 'Oreo',                slug: 'oreo',            isFeatured: false },
  { name: 'Haribo',              slug: 'haribo',          isFeatured: false },
  { name: 'PopCorners',          slug: 'popcorners',      isFeatured: false },
  { name: "Ben & Jerry's",       slug: 'benjerry',        isFeatured: false },
  { name: 'Takis',               slug: 'takis',           isFeatured: false },
  { name: 'Papa & Barkley',      slug: 'papabarkley',     isFeatured: false },
  { name: "Mary's Medicinals",   slug: 'marysmedicinals', isFeatured: false },
];

// brand = brandSlug, cat = category frontendId, img = filename on CDN
const PRODUCTS_RAW = [
  // ── Accessories (4) ──────────────────────────────────────────────────────────
  { fid:13287, brand:'Moxie',       cat:'4',  name:'510 Battery',                   price:'$4.99',   stock:65,  r:4.0, rc:94,  opts:null, img:'x375-img-1-1734387723436.png.webp' },
  { fid:10137, brand:'focusv',      cat:'4',  name:'Aeris Kit',                     price:'$179.99', stock:5,   r:5.0, rc:1,   opts:null, img:'x375-img-9-1718036036393.png.webp' },
  { fid:10363, brand:'focusv',      cat:'4',  name:'Aeris Replacement Parts',       price:'$56.99',  stock:20,  r:5.0, rc:2,   opts:3,   img:'x375-img-18_1-1732563870831.png.webp' },
  { fid:11195, brand:'Maven',       cat:'4',  name:'Alpha + Torch Lighter',         price:'$2.99',   stock:39,  r:4.8, rc:45,  opts:null, img:'x375-img-51-1732564035024.png.webp' },
  { fid:15125, brand:'santacruz',   cat:'4',  name:'Aluminum 4pc Small Grinder',    price:'$42.99',  stock:5,   r:5.0, rc:2,   opts:4,   img:'x375-img-8-1742580280554.png.webp' },
  { fid:11174, brand:'Maven',       cat:'4',  name:'Apex Torch',                    price:'$12.99',  stock:24,  r:0,   rc:0,   opts:6,   img:'x375-img-9-1728593013703.png.webp' },
  { fid:5579,  brand:'710Labs',     cat:'4',  name:'Battery',                       price:'P120',    stock:13,  r:4.9, rc:31,  opts:3,   img:'x375-img-42-1682614574351-copy-1718297138936.png.webp' },
  { fid:16175, brand:'PlugPlay',    cat:'4',  name:'Battery',                       price:'$18.99',  stock:15,  r:4.8, rc:22,  opts:5,   img:'x375-img-3-1729289026237.png.webp' },
  { fid:11740, brand:'CaliCrusher', cat:'4',  name:'Cali OG 2.5" Grinder',          price:'$27.99',  stock:14,  r:5.0, rc:6,   opts:null, img:'x375-1-1727298977885.png.webp' },
  { fid:11191, brand:'Maven',       cat:'4',  name:'Cannon Torch',                  price:'$6.99',   stock:17,  r:4.5, rc:2,   opts:3,   img:'x375-img-22-black-1724348362264.png.webp' },
  { fid:11093, brand:'focusv',      cat:'4',  name:'Carta 2 Glass Replacements',    price:'$47.99',  stock:13,  r:0,   rc:0,   opts:null, img:'x375-img-19-1719957225617.png.webp' },
  { fid:10430, brand:'focusv',      cat:'4',  name:'Carta 2 Intelli-Core For Herb', price:'$29.99',  stock:12,  r:4.8, rc:2,   opts:null, img:'x375-img-35-1719259585508.png.webp' },
  { fid:11700, brand:'formula420',  cat:'4',  name:'Cleaner',                       price:'$10.99',  stock:7,   r:0,   rc:0,   opts:null, img:'x375-img-16-1725902937664.png.webp' },
  { fid:14573, brand:'raw',         cat:'4',  name:'Cone Filler',                   price:'$8.99',   stock:23,  r:4.9, rc:6,   opts:null, img:'x375-img-15-1739911173431.png.webp' },
  { fid:8007,  brand:'raw',         cat:'4',  name:'Cones',                         price:'$2.99',   stock:999, r:4.8, rc:64,  opts:4,   img:'x375-pnke-1-1708991319182.png.webp' },
  // ── BYOB (11) ────────────────────────────────────────────────────────────────
  { fid:20001, brand:'chads', cat:'11', name:'BYOB Bundle — Starter', price:'$24.99', stock:30, r:4.7, rc:18, opts:3,   img:'x375-img-1-1734387723436.png.webp' },
  { fid:20002, brand:'chads', cat:'11', name:'BYOB Bundle — Classic', price:'$39.99', stock:22, r:4.9, rc:34, opts:5,   img:'x375-img-9-1718036036393.png.webp' },
  { fid:20003, brand:'chads', cat:'11', name:'BYOB Bundle — Premium', price:'$59.99', stock:10, r:5.0, rc:12, opts:4,   img:'x375-img-18_1-1732563870831.png.webp' },
  { fid:20004, brand:'chads', cat:'11', name:'BYOB Bundle — Deluxe',  price:'$89.99', stock:6,  r:5.0, rc:7,  opts:6,   img:'x375-img-51-1732564035024.png.webp' },
  { fid:20005, brand:'chads', cat:'11', name:'BYOB Gift Box',              price:'$49.99', stock:15, r:4.8, rc:9,  opts:2,   img:'x375-img-8-1742580280554.png.webp' },
  // ── Carts (1) ────────────────────────────────────────────────────────────────
  { fid:30001, brand:'Moxie',    cat:'1', name:'Blue Dream Cart 1g',           price:'$34.99', stock:42, r:4.7, rc:88,  opts:null, img:'x375-img-9-1728593013703.png.webp' },
  { fid:30002, brand:'PlugPlay', cat:'1', name:'Gelato Cart 1g',               price:'$38.99', stock:28, r:4.9, rc:55,  opts:null, img:'x375-img-3-1729289026237.png.webp' },
  { fid:30003, brand:'710Labs',  cat:'1', name:'OG Kush Live Resin Cart 0.5g', price:'$29.99', stock:19, r:5.0, rc:23,  opts:null, img:'x375-img-42-1682614574351-copy-1718297138936.png.webp' },
  { fid:30004, brand:'Moxie',    cat:'1', name:'Pineapple Express Cart 1g',    price:'$34.99', stock:36, r:4.6, rc:41,  opts:null, img:'x375-img-1-1734387723436.png.webp' },
  { fid:30005, brand:'PlugPlay', cat:'1', name:'Skywalker OG Cart 1g',         price:'$38.99', stock:0,  r:4.8, rc:30,  opts:null, img:'x375-img-9-1718036036393.png.webp' },
  { fid:30006, brand:'710Labs',  cat:'1', name:'Strawberry Cough Cart 1g',     price:'$36.99', stock:11, r:4.9, rc:19,  opts:null, img:'x375-img-22-black-1724348362264.png.webp' },
  { fid:30007, brand:'Moxie',    cat:'1', name:'Wedding Cake Cart 1g',         price:'$34.99', stock:50, r:4.7, rc:62,  opts:null, img:'x375-img-35-1719259585508.png.webp' },
  // ── Concentrates (3) ─────────────────────────────────────────────────────────
  { fid:40001, brand:'710Labs', cat:'3', name:'Badder — Banana Punch 1g',      price:'$44.99', stock:8,  r:5.0, rc:14, opts:null, img:'x375-img-42-1682614574351-copy-1718297138936.png.webp' },
  { fid:40002, brand:'710Labs', cat:'3', name:'Diamonds — Wedding Crasher 1g', price:'$54.99', stock:6,  r:4.9, rc:9,  opts:null, img:'x375-1-1727298977885.png.webp' },
  { fid:40003, brand:'Moxie',   cat:'3', name:'Live Resin — Gelato 1g',        price:'$48.99', stock:12, r:4.8, rc:22, opts:null, img:'x375-img-16-1725902937664.png.webp' },
  { fid:40004, brand:'Moxie',   cat:'3', name:'Rosin — Zkittlez 0.5g',         price:'$39.99', stock:4,  r:5.0, rc:5,  opts:null, img:'x375-img-19-1719957225617.png.webp' },
  { fid:40005, brand:'710Labs', cat:'3', name:'Sauce — OG Chem 1g',            price:'$49.99', stock:9,  r:4.7, rc:11, opts:null, img:'x375-img-51-1732564035024.png.webp' },
  { fid:40006, brand:'focusv',  cat:'3', name:'Shatter — Purple Punch 1g',     price:'$32.99', stock:15, r:4.5, rc:8,  opts:null, img:'x375-img-9-1728593013703.png.webp' },
  // ── Disposables (6) ──────────────────────────────────────────────────────────
  { fid:50001, brand:'PlugPlay', cat:'6', name:'Blue Raspberry Disposable 1g',      price:'$24.99', stock:55, r:4.6, rc:77, opts:null, img:'x375-img-3-1729289026237.png.webp' },
  { fid:50002, brand:'Moxie',    cat:'6', name:'Grape Ape Disposable 1g',           price:'$22.99', stock:33, r:4.4, rc:43, opts:null, img:'x375-img-1-1734387723436.png.webp' },
  { fid:50003, brand:'PlugPlay', cat:'6', name:'Lemon Haze Disposable 2g',          price:'$34.99', stock:18, r:4.8, rc:29, opts:null, img:'x375-img-9-1718036036393.png.webp' },
  { fid:50004, brand:'Moxie',    cat:'6', name:'Mango Kush Disposable 1g',          price:'$22.99', stock:0,  r:4.7, rc:38, opts:null, img:'x375-img-18_1-1732563870831.png.webp' },
  { fid:50005, brand:'PlugPlay', cat:'6', name:'Watermelon Zkittlez Disposable 2g', price:'$34.99', stock:24, r:4.9, rc:51, opts:null, img:'x375-img-8-1742580280554.png.webp' },
  // ── Edibles (7) ──────────────────────────────────────────────────────────────
  { fid:60001, brand:'wyld', cat:'7', name:'Blackberry Gummies 100mg',             price:'$18.99', stock:88,  r:4.8, rc:120, opts:null, img:'x375-img-15-1739911173431.png.webp' },
  { fid:60002, brand:'kiva', cat:'7', name:'Dark Chocolate Bar 100mg',             price:'$21.99', stock:45,  r:4.9, rc:98,  opts:3,   img:'x375-pnke-1-1708991319182.png.webp' },
  { fid:60003, brand:'wyld', cat:'7', name:'Elderberry Gummies 1:1 CBD 200mg',     price:'$22.99', stock:30,  r:4.7, rc:56,  opts:null, img:'x375-img-16-1725902937664.png.webp' },
  { fid:60004, brand:'kiva', cat:'7', name:'Milk Chocolate Bar 100mg',             price:'$21.99', stock:52,  r:4.8, rc:74,  opts:2,   img:'x375-img-9-1728593013703.png.webp' },
  { fid:60005, brand:'wyld', cat:'7', name:'Peach Gummies 100mg',                  price:'$18.99', stock:61,  r:4.9, rc:102, opts:null, img:'x375-img-22-black-1724348362264.png.webp' },
  { fid:60006, brand:'kiva', cat:'7', name:'Raspberry Dark Chocolate Bites 100mg', price:'$19.99', stock:38,  r:4.6, rc:47,  opts:null, img:'x375-img-1-1734387723436.png.webp' },
  { fid:60007, brand:'wyld', cat:'7', name:'Strawberry Gummies 10-pack 100mg',     price:'$16.99', stock:999, r:4.7, rc:135, opts:null, img:'x375-img-35-1719259585508.png.webp' },
  // ── Flower (2) ───────────────────────────────────────────────────────────────
  { fid:70001, brand:'alienlabs',  cat:'2', name:'Area 41 — 3.5g',       price:'$54.99', stock:16, r:4.9, rc:47, opts:2,   img:'x375-img-19-1719957225617.png.webp' },
  { fid:70002, brand:'connected',  cat:'2', name:'Biscotti — 3.5g',      price:'$52.99', stock:9,  r:4.8, rc:35, opts:null, img:'x375-img-42-1682614574351-copy-1718297138936.png.webp' },
  { fid:70003, brand:'alienlabs',  cat:'2', name:'Galactic Gas — 7g',    price:'$89.99', stock:5,  r:5.0, rc:18, opts:null, img:'x375-1-1727298977885.png.webp' },
  { fid:70004, brand:'connected',  cat:'2', name:'Gushers — 3.5g',       price:'$52.99', stock:21, r:4.7, rc:29, opts:null, img:'x375-img-9-1718036036393.png.webp' },
  { fid:70005, brand:'alienlabs',  cat:'2', name:'Melonade — 3.5g',      price:'$54.99', stock:12, r:4.8, rc:22, opts:2,   img:'x375-img-3-1729289026237.png.webp' },
  { fid:70006, brand:'jungleboys', cat:'2', name:'Papaya Nights — 3.5g', price:'$58.99', stock:7,  r:5.0, rc:11, opts:null, img:'x375-img-18_1-1732563870831.png.webp' },
  { fid:70007, brand:'jungleboys', cat:'2', name:'Runtz — 7g',           price:'$94.99', stock:3,  r:4.9, rc:14, opts:null, img:'x375-img-8-1742580280554.png.webp' },
  { fid:70008, brand:'connected',  cat:'2', name:'Sour Diesel — 3.5g',   price:'$48.99', stock:33, r:4.6, rc:53, opts:null, img:'x375-img-51-1732564035024.png.webp' },
  // ── Merch (8) ────────────────────────────────────────────────────────────────
  { fid:80001, brand:'chads', cat:'8', name:"Chad's Logo Beanie",            price:'$24.99', stock:40,  r:4.7, rc:12, opts:3,   img:'x375-img-16-1725902937664.png.webp' },
  { fid:80002, brand:'chads', cat:'8', name:"Chad's Logo Hoodie",            price:'$54.99', stock:25,  r:4.9, rc:8,  opts:5,   img:'x375-img-22-black-1724348362264.png.webp' },
  { fid:80003, brand:'chads', cat:'8', name:"Chad's Logo Sticker Pack",      price:'$7.99',  stock:150, r:4.8, rc:33, opts:null, img:'x375-img-1-1734387723436.png.webp' },
  { fid:80004, brand:'chads', cat:'8', name:"Chad's Logo T-Shirt",           price:'$34.99', stock:60,  r:4.8, rc:19, opts:6,   img:'x375-img-9-1728593013703.png.webp' },
  { fid:80005, brand:'chads', cat:'8', name:"Rolling Tray — Chad's Edition", price:'$19.99', stock:35, r:4.9, rc:27, opts:2, img:'x375-img-15-1739911173431.png.webp' },
  // ── Munchies (13) ────────────────────────────────────────────────────────────
  { fid:90001, brand:'lays',       cat:'13', name:'Classic Chips Family Size', price:'$5.99', stock:200, r:4.5, rc:88,  opts:null, img:'x375-pnke-1-1708991319182.png.webp' },
  { fid:90002, brand:'oreo',       cat:'13', name:'Double Stuf Cookies',       price:'$4.99', stock:180, r:4.9, rc:141, opts:null, img:'x375-img-15-1739911173431.png.webp' },
  { fid:90003, brand:'haribo',     cat:'13', name:'Gold-Bears Gummies 28oz',   price:'$8.99', stock:120, r:4.8, rc:203, opts:null, img:'x375-img-16-1725902937664.png.webp' },
  { fid:90004, brand:'popcorners', cat:'13', name:'Popcorners Kettle Corn',    price:'$4.49', stock:95,  r:4.6, rc:67,  opts:null, img:'x375-img-19-1719957225617.png.webp' },
  { fid:90005, brand:'benjerry',   cat:'13', name:'Pint Assortment',           price:'$6.99', stock:50,  r:4.9, rc:159, opts:6,   img:'x375-img-35-1719259585508.png.webp' },
  { fid:90006, brand:'takis',      cat:'13', name:'Fuego Rolled Chips 9.9oz',  price:'$4.99', stock:110, r:4.7, rc:92,  opts:null, img:'x375-img-42-1682614574351-copy-1718297138936.png.webp' },
  // ── Pre-rolls (9) ────────────────────────────────────────────────────────────
  { fid:100001, brand:'raw',        cat:'9', name:'Blue Dream Pre-roll 1g',                price:'$12.99', stock:75, r:4.6, rc:48, opts:null, img:'x375-img-9-1718036036393.png.webp' },
  { fid:100002, brand:'jungleboys', cat:'9', name:'Gorilla Glue #4 Infused Pre-roll 1.5g', price:'$22.99', stock:20, r:4.9, rc:31, opts:null, img:'x375-img-18_1-1732563870831.png.webp' },
  { fid:100003, brand:'raw',        cat:'9', name:'OG Kush Pre-roll 3-pack',               price:'$29.99', stock:40, r:4.7, rc:27, opts:null, img:'x375-img-8-1742580280554.png.webp' },
  { fid:100004, brand:'alienlabs',  cat:'9', name:'Pink Runtz Infused Pre-roll 1.5g',      price:'$24.99', stock:14, r:5.0, rc:16, opts:null, img:'x375-img-51-1732564035024.png.webp' },
  { fid:100005, brand:'jungleboys', cat:'9', name:'Wedding Cake Pre-roll 5-pack',          price:'$44.99', stock:8,  r:4.8, rc:11, opts:null, img:'x375-1-1727298977885.png.webp' },
  { fid:100006, brand:'raw',        cat:'9', name:'Zkittlez Pre-roll 1g',                  price:'$12.99', stock:55, r:4.5, rc:39, opts:null, img:'x375-img-9-1728593013703.png.webp' },
  // ── Topical (10) ─────────────────────────────────────────────────────────────
  { fid:110001, brand:'papabarkley',     cat:'10', name:'1:3 CBD:THC Releaf Balm 15ml', price:'$34.99', stock:28, r:4.7, rc:44, opts:null, img:'x375-img-16-1725902937664.png.webp' },
  { fid:110002, brand:'marysmedicinals', cat:'10', name:'CBD Patch 10mg 5-pack',        price:'$28.99', stock:19, r:4.8, rc:33, opts:null, img:'x375-img-22-black-1724348362264.png.webp' },
  { fid:110003, brand:'papabarkley',     cat:'10', name:'Releaf Body Oil 30ml',         price:'$44.99', stock:11, r:4.9, rc:18, opts:null, img:'x375-img-35-1719259585508.png.webp' },
  { fid:110004, brand:'marysmedicinals', cat:'10', name:'THC Muscle Freeze 74ml',       price:'$38.99', stock:22, r:4.6, rc:26, opts:null, img:'x375-img-19-1719957225617.png.webp' },
  { fid:110005, brand:'papabarkley',     cat:'10', name:'Releaf Tincture 30:1 CBD:THC', price:'$49.99', stock:16, r:4.8, rc:21, opts:2,   img:'x375-img-15-1739911173431.png.webp' },
  // ── Rewards (-1) ─────────────────────────────────────────────────────────────
  { fid:120001, brand:'chads', cat:'-1', name:'500 Point Discount Voucher',        price:'P500',  stock:999, r:5.0, rc:61, opts:null, img:'x375-img-1-1734387723436.png.webp' },
  { fid:120002, brand:'chads', cat:'-1', name:'1000 Point Free Shipping Pass',     price:'P1000', stock:999, r:4.9, rc:48, opts:null, img:'x375-img-9-1718036036393.png.webp' },
  { fid:120003, brand:'chads', cat:'-1', name:'2000 Point Mystery Box',            price:'P2000', stock:50,  r:4.8, rc:22, opts:null, img:'x375-img-18_1-1732563870831.png.webp' },
  { fid:120004, brand:'chads', cat:'-1', name:'3500 Point Exclusive Merch Bundle', price:'P3500', stock:20,  r:5.0, rc:9,  opts:3,   img:'x375-img-8-1742580280554.png.webp' },
  { fid:120005, brand:'chads', cat:'-1', name:'5000 Point VIP Membership',         price:'P5000', stock:10,  r:5.0, rc:4,  opts:null, img:'x375-img-51-1732564035024.png.webp' },
];

const SYSTEM_STATUSES = [
  { service: 'Website',              description: 'Main storefront',         status: 'operational', uptimePct: '99.9%' },
  { service: 'API',                  description: 'Product and order API',   status: 'operational', uptimePct: '99.8%' },
  { service: 'Payment Processing',   description: 'XMR/BTC/ETH gateway',    status: 'operational', uptimePct: '99.5%' },
  { service: 'Order Management',     description: 'Order creation/tracking', status: 'operational', uptimePct: '100%'  },
  { service: 'Search',               description: 'Product search/filtering',status: 'operational', uptimePct: '99.9%' },
  { service: 'Shipping Integration', description: 'Carrier tracking/labels', status: 'operational', uptimePct: '98.7%' },
  { service: 'Support System',       description: 'Ticket management',       status: 'operational', uptimePct: '100%'  },
  { service: 'CDN / Media',          description: 'Images/assets',           status: 'operational', uptimePct: '99.9%' },
];

const INCIDENTS = [
  {
    dateLabel:   'May 15, 2026',
    title:       'Payment Processing Delay',
    status:      'resolved',
    description: 'Some users experienced delays in payment confirmation. Issue resolved within 2 hours.',
  },
  {
    dateLabel:   'Apr 28, 2026',
    title:       'CDN Latency Issues',
    status:      'resolved',
    description: 'Images loading slowly in some regions. CDN cache cleared and performance restored.',
  },
];

const now = () => new Date();
const daysAgo   = d => new Date(Date.now() - d * 864e5);
const daysAhead = d => new Date(Date.now() + d * 864e5);

const NEWS = [
  { title: 'New Alien Labs Drop — Area 41 Now In Stock', slug: 'new-alien-labs-drop-area-41',      category: 'Products',  excerpt: 'The highly anticipated Area 41 strain from Alien Labs has arrived...', tag: 'New',         tagColor: '#43a047', isPublished: true, publishedAt: daysAgo(2)  },
  { title: 'Summer 2026 Giveaway — $500 Prize Pool',    slug: 'summer-2026-giveaway',             category: 'Giveaways', excerpt: 'Enter our biggest giveaway yet for a chance to win...',               tag: 'Hot',         tagColor: '#e53935', isPublished: true, publishedAt: daysAgo(5)  },
  { title: 'Rewards Program Update — New Platinum Perks',slug:'rewards-program-update-platinum',  category: 'Rewards',   excerpt: 'We have upgraded the Platinum tier with exclusive benefits...',       tag: 'Update',      tagColor: '#2196f3', isPublished: true, publishedAt: daysAgo(10) },
  { title: 'Site Maintenance — June 15',                 slug: 'site-maintenance-june-15',         category: 'Updates',   excerpt: 'Scheduled maintenance window on June 15 from 2AM to 4AM EST...',    tag: 'Maintenance', tagColor: '#ff9800', isPublished: true, publishedAt: daysAgo(1)  },
  { title: 'Focus V Carta 2 — Back In Stock',            slug: 'focus-v-carta-2-back-in-stock',    category: 'Products',  excerpt: 'The popular Focus V Carta 2 accessories are back...',               tag: 'New',         tagColor: '#43a047', isPublished: true, publishedAt: daysAgo(7)  },
  { title: 'Introducing BYOB Bundles',                        slug: 'introducing-byob-bundles',         category: 'Products',  excerpt: 'Build your perfect bundle with our new BYOB category...',           tag: 'New',         tagColor: '#43a047', isPublished: true, publishedAt: daysAgo(14) },
];

const GIVEAWAYS = [
  {
    title: 'Summer 2026 Mega Giveaway', badge: '🔥 HOT',
    gradientFrom: '#e91e63', gradientTo: '#9c27b0', gradientAngle: 135,
    value: '$500+', description: 'Enter for a chance to win our biggest prize pool ever.',
    prizes: [
      '🥇 Focus V Aeris Kit + $100 store credit',
      '🥈 $150 store credit',
      '🥉 $75 store credit + Alien Labs bundle',
    ],
    endsAt: daysAhead(83), maxEntries: null, entriesCount: 3842, winnersCount: 3, isActive: true,
  },
  {
    title: 'Weekly Flash Giveaway', badge: '⚡ FLASH',
    gradientFrom: '#ff6f00', gradientTo: '#ff8f00', gradientAngle: 135,
    value: '$100', description: 'Quick weekly giveaway — enter before it ends!',
    prizes: ['🥇 $100 store credit + free shipping for 3 months'],
    endsAt: daysAhead(3), maxEntries: null, entriesCount: 847, winnersCount: 1, isActive: true,
  },
  {
    title: 'VIP Members Exclusive', badge: '⭐ VIP',
    gradientFrom: '#1565c0', gradientTo: '#0d47a1', gradientAngle: 135,
    value: '$250+', description: 'Exclusive giveaway for our most loyal members.',
    prizes: [
      '🥇 Platinum tier upgrade + $200 store credit',
      '🥈 Gold tier upgrade + $75 store credit',
    ],
    endsAt: daysAhead(21), maxEntries: null, entriesCount: 124, winnersCount: 2, isActive: true,
  },
];

const FAQ = [
  { question: 'How do I place an order?',                        answer: 'Browse our catalog, add items to your cart, and proceed to checkout. You will need a funded wallet balance to complete your purchase.',                                                              sortOrder: 1  },
  { question: 'What cryptocurrencies do you accept for deposits?', answer: 'We accept Bitcoin (BTC), Dogecoin (DOGE), Litecoin (LTC), and Monero (XMR) for wallet deposits.',                                                                                               sortOrder: 2  },
  { question: 'How long does shipping take?',                     answer: 'Standard shipping takes 3-5 business days. Express shipping (1-2 business days) is available at checkout.',                                                                                        sortOrder: 3  },
  { question: 'What is your refund policy?',                      answer: 'We accept refunds within 7 days of delivery for unopened items. Contact support with your order ID to initiate a return.',                                                                          sortOrder: 4  },
  { question: 'How does the rewards system work?',                answer: 'You earn 0.5 points for every dollar spent. Points accumulate toward tier upgrades and can be redeemed for exclusive rewards products.',                                                            sortOrder: 5  },
  { question: 'What are the loyalty tier benefits?',              answer: 'Basic (0-$999): 0.5% cashback. Preferred ($1k-$1.9k): 1.0%. Gold ($2k-$4.9k): 1.3%. Platinum ($5k+): 1.5% cashback on all purchases.',                                                           sortOrder: 6  },
  { question: 'How do I track my order?',                         answer: 'Once your order ships, you will receive a tracking number via your notification settings. You can also view it in your Orders page.',                                                               sortOrder: 7  },
  { question: 'Is my information secure?',                        answer: 'Yes. We use industry-standard encryption and never store sensitive payment information. All transactions are processed via blockchain.',                                                             sortOrder: 8  },
  { question: 'Can I change or cancel my order?',                 answer: 'Orders in "Processing" status can be cancelled. Once an order is shipped, it cannot be cancelled but may be eligible for a return.',                                                               sortOrder: 9  },
  { question: 'How do crypto deposits work?',                     answer: 'Go to your Wallet page, select a cryptocurrency, and send any amount to the generated address. Your balance is credited in USD at the confirmed exchange rate. Addresses expire after 12 hours.',  sortOrder: 10 },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Site settings
  for (const s of SETTINGS) {
    await prisma.siteSetting.upsert({ where: { key: s.key }, create: s, update: { value: s.value } });
  }
  console.log(`✓ Site settings seeded (${SETTINGS.length})`);

  // 2. Categories
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where:  { frontendId: c.frontendId },
      create: c,
      update: { label: c.label, slug: c.slug, sortOrder: c.sortOrder, isFeatured: c.isFeatured },
    });
  }
  console.log(`✓ Categories seeded (${CATEGORIES.length})`);

  // 3. Brands
  for (const b of BRANDS) {
    await prisma.brand.upsert({
      where:  { slug: b.slug },
      create: b,
      update: { name: b.name, isFeatured: b.isFeatured },
    });
  }
  console.log(`✓ Brands seeded (${BRANDS.length})`);

  // Build lookup maps for IDs
  const catMap = {};
  for (const c of await prisma.category.findMany()) catMap[c.frontendId] = c.id;
  const brandMap = {};
  for (const b of await prisma.brand.findMany())    brandMap[b.slug] = b.id;

  // 4. Products
  let productCount = 0;
  for (const p of PRODUCTS_RAW) {
    const { price, priceType } = parsePrice(p.price);
    const slug = uniqueSlug(p.name, p.fid);
    const data = {
      frontendId:   p.fid,
      brandId:      brandMap[p.brand]   ?? null,
      categoryId:   catMap[p.cat]       ?? null,
      name:         p.name,
      slug,
      price,
      priceType,
      stock:        p.stock,
      imageUrl:     CDN + p.img,
      rating:       p.r,
      reviewCount:  p.rc,
      optionsCount: p.opts,
    };
    await prisma.product.upsert({
      where:  { frontendId: p.fid },
      create: data,
      update: { ...data, frontendId: undefined },
    });
    productCount++;
  }
  console.log(`✓ Products seeded (${productCount})`);

  // 5. System status
  for (const s of SYSTEM_STATUSES) {
    await prisma.systemStatus.upsert({
      where:  { service: s.service },
      create: s,
      update: { status: s.status, description: s.description, uptimePct: s.uptimePct },
    });
  }
  console.log(`✓ System status seeded (${SYSTEM_STATUSES.length})`);

  // 6. System incidents (insert once)
  const incidentCount = await prisma.systemIncident.count();
  if (incidentCount === 0) {
    await prisma.systemIncident.createMany({ data: INCIDENTS });
  }
  console.log(`✓ System incidents seeded (${INCIDENTS.length})`);

  // 7. News
  for (const n of NEWS) {
    await prisma.news.upsert({
      where:  { slug: n.slug },
      create: n,
      update: { title: n.title, excerpt: n.excerpt, tag: n.tag, tagColor: n.tagColor },
    });
  }
  console.log(`✓ News seeded (${NEWS.length})`);

  // 8. Giveaways (insert once)
  const giveawayCount = await prisma.giveaway.count();
  if (giveawayCount === 0) {
    for (const g of GIVEAWAYS) {
      await prisma.giveaway.create({ data: g });
    }
  }
  console.log(`✓ Giveaways seeded (${GIVEAWAYS.length})`);

  // 9. FAQ (insert once)
  const faqCount = await prisma.faq.count();
  if (faqCount === 0) {
    await prisma.faq.createMany({ data: FAQ });
  }
  console.log(`✓ FAQ seeded (${FAQ.length})`);

  // 10. Admin user
  const passwordHash = await bcrypt.hash('Admin@1234', 12);
  await prisma.user.upsert({
    where:  { email: 'mario@dmin1234' },
    create: {
      email: 'mario@dmin1234',
      passwordHash,
      username: 'Mario',
      role:     'admin',
      isActive: true,
    },
    update: { passwordHash, role: 'admin', isActive: true },
  });
  console.log('✓ Admin user seeded');

  console.log('\nSeed completed successfully!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
