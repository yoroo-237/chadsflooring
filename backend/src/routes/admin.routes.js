const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const { uploadProductImage } = require('../middlewares/upload');

const dashboardCtrl    = require('../controllers/admin/dashboard.controller');
const usersCtrl        = require('../controllers/admin/users.controller');
const ordersCtrl       = require('../controllers/admin/orders.controller');
const productsCtrl     = require('../controllers/admin/products.controller');
const depositsCtrl     = require('../controllers/admin/deposits.controller');
const transactionsCtrl = require('../controllers/admin/transactions.controller');
const supportCtrl      = require('../controllers/admin/support.controller');
const reviewsCtrl      = require('../controllers/admin/reviews.controller');
const contentCtrl      = require('../controllers/admin/content.controller');
const analyticsCtrl    = require('../controllers/admin/analytics.controller');
const settingsCtrl     = require('../controllers/admin/settings.controller');
const categoriesCtrl   = require('../controllers/categories.controller');
const brandsCtrl       = require('../controllers/brands.controller');

const router = Router();

router.use(requireAuth, requireAdmin);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', dashboardCtrl.getDashboard);

// ─── Users ───────────────────────────────────────────────────────────────────
router.get('/users',                     usersCtrl.listUsers);
router.post('/users',                    usersCtrl.createUser);
router.get('/users/:id',                 usersCtrl.getUserById);
router.put('/users/:id',                 usersCtrl.updateUser);
router.patch('/users/:id/ban',           usersCtrl.banUser);
router.post('/users/:id/wallet/adjust',  usersCtrl.adjustWallet);

// ─── Orders ──────────────────────────────────────────────────────────────────
router.get('/orders',                ordersCtrl.listOrders);
router.patch('/orders/:id/status',   ordersCtrl.updateOrderStatus);
router.patch('/orders/:id/tracking', ordersCtrl.updateOrderTracking);

// ─── Products ────────────────────────────────────────────────────────────────
router.get('/products',              productsCtrl.listProducts);
router.post('/products',             uploadProductImage, productsCtrl.createProduct);
router.put('/products/:id',          productsCtrl.updateProduct);
router.delete('/products/:id',       productsCtrl.removeProduct);
router.patch('/products/:id/stock',  productsCtrl.patchStock);

// ─── Deposits ────────────────────────────────────────────────────────────────
router.get('/deposits',                depositsCtrl.listDeposits);
router.patch('/deposits/:id/confirm',  depositsCtrl.confirmDeposit);
router.patch('/deposits/:id/expire',   depositsCtrl.expireDeposit);

// ─── Transactions ─────────────────────────────────────────────────────────────
router.get('/transactions', transactionsCtrl.listTransactions);

// ─── Support ─────────────────────────────────────────────────────────────────
router.get('/support/stats',                      supportCtrl.getStats);
router.get('/support',                            supportCtrl.listTickets);
router.get('/support/tickets',                    supportCtrl.listTickets);
router.post('/support/tickets/:id/messages',      supportCtrl.createMessage);
router.patch('/support/tickets/:id/status',       supportCtrl.updateTicketStatus);
router.patch('/support/tickets/:id/assign',       supportCtrl.assignTicket);
router.patch('/support/tickets/:id/priority',     supportCtrl.updatePriority);

// ─── Reviews ─────────────────────────────────────────────────────────────────
router.get('/reviews',                reviewsCtrl.listReviews);
router.patch('/reviews/:id/approve',  reviewsCtrl.approveReview);
router.delete('/reviews/:id',         reviewsCtrl.deleteReview);

// ─── Content: News ───────────────────────────────────────────────────────────
router.get('/news',        contentCtrl.listNews);
router.post('/news',       contentCtrl.createNews);
router.put('/news/:id',    contentCtrl.updateNews);
router.delete('/news/:id', contentCtrl.deleteNews);

// ─── Content: FAQ — /faq/reorder must come before /faq/:id ──────────────────
router.get('/faq',           contentCtrl.listFaq);
router.post('/faq',          contentCtrl.createFaq);
router.put('/faq/reorder',   contentCtrl.reorderFaq);
router.put('/faq/:id',       contentCtrl.updateFaq);
router.delete('/faq/:id',    contentCtrl.deleteFaq);

// ─── Content: Giveaways ──────────────────────────────────────────────────────
router.get('/giveaways',               contentCtrl.listGiveaways);
router.post('/giveaways',              contentCtrl.createGiveaway);
router.put('/giveaways/:id',           contentCtrl.updateGiveaway);
router.delete('/giveaways/:id',        contentCtrl.deleteGiveaway);
router.get('/giveaways/:id/entries',   contentCtrl.getGiveawayEntries);

// ─── Analytics ───────────────────────────────────────────────────────────────
router.get('/analytics', analyticsCtrl.getAnalytics);

// ─── Catalog lookups (for product form dropdowns) ─────────────────────────────
router.get('/categories', categoriesCtrl.list);
router.get('/brands',     brandsCtrl.list);

// ─── Settings ────────────────────────────────────────────────────────────────
router.get('/settings',                    settingsCtrl.getAllSettings);
router.put('/settings',                    settingsCtrl.updateSettings);
router.get('/system-status',               settingsCtrl.getSystemStatus);
router.put('/system-status/:id',           settingsCtrl.updateSystemStatus);
router.get('/system-status/incidents',     settingsCtrl.listIncidents);
router.post('/system-status/incidents',    settingsCtrl.createIncident);
router.put('/system-status/incidents/:id', settingsCtrl.updateIncident);
router.delete('/system-status/incidents/:id', settingsCtrl.deleteIncident);

module.exports = router;
