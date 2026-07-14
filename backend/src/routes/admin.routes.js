const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const { uploadProductImage } = require('../middlewares/upload');
const wrap = require('../utils/asyncHandler');

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
const ethCtrl          = require('../controllers/admin/eth.controller');
const utxoCtrl         = require('../controllers/admin/utxo.controller');

const router = Router();

router.use(requireAuth, requireAdmin);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', wrap(dashboardCtrl.getDashboard));

// ─── Users ───────────────────────────────────────────────────────────────────
router.get('/users',                     wrap(usersCtrl.listUsers));
router.post('/users',                    wrap(usersCtrl.createUser));
router.get('/users/:id',                 wrap(usersCtrl.getUserById));
router.put('/users/:id',                 wrap(usersCtrl.updateUser));
router.patch('/users/:id/ban',           wrap(usersCtrl.banUser));
router.patch('/users/:id/password',      wrap(usersCtrl.resetPassword));
router.post('/users/:id/wallet/adjust',  wrap(usersCtrl.adjustWallet));

// ─── Orders ──────────────────────────────────────────────────────────────────
router.get('/orders',                wrap(ordersCtrl.listOrders));
router.patch('/orders/:id/status',   wrap(ordersCtrl.updateOrderStatus));
router.patch('/orders/:id/tracking', wrap(ordersCtrl.updateOrderTracking));

// ─── Products ────────────────────────────────────────────────────────────────
router.get('/products',              wrap(productsCtrl.listProducts));
router.post('/products',             uploadProductImage, wrap(productsCtrl.createProduct));
router.get('/products/:id',          wrap(productsCtrl.getProductById));
router.put('/products/:id',          wrap(productsCtrl.updateProduct));
router.delete('/products/:id',       wrap(productsCtrl.removeProduct));
router.patch('/products/:id/stock',  wrap(productsCtrl.patchStock));

// ─── Deposits ────────────────────────────────────────────────────────────────
router.get('/deposits',                wrap(depositsCtrl.listDeposits));
router.post('/deposits/cleanup',       wrap(depositsCtrl.cleanup));
router.patch('/deposits/:id/confirm',  wrap(depositsCtrl.confirmDeposit));
router.patch('/deposits/:id/expire',   wrap(depositsCtrl.expireDeposit));

// ─── Transactions ─────────────────────────────────────────────────────────────
router.get('/transactions', wrap(transactionsCtrl.listTransactions));

// ─── Support ─────────────────────────────────────────────────────────────────
router.get('/support/stats',                      wrap(supportCtrl.getStats));
router.get('/support',                            wrap(supportCtrl.listTickets));
router.get('/support/tickets',                    wrap(supportCtrl.listTickets));
router.get('/support/tickets/:id',                wrap(supportCtrl.getTicket));
router.get('/support/:id',                        wrap(supportCtrl.getTicket));
router.post('/support/tickets/:id/messages',      wrap(supportCtrl.createMessage));
router.patch('/support/tickets/:id/status',       wrap(supportCtrl.updateTicketStatus));
router.patch('/support/tickets/:id/assign',       wrap(supportCtrl.assignTicket));
router.patch('/support/tickets/:id/priority',     wrap(supportCtrl.updatePriority));

// ─── Reviews ─────────────────────────────────────────────────────────────────
router.get('/reviews',                wrap(reviewsCtrl.listReviews));
router.patch('/reviews/:id/approve',  wrap(reviewsCtrl.approveReview));
router.delete('/reviews/:id',         wrap(reviewsCtrl.deleteReview));

// ─── Content: News ───────────────────────────────────────────────────────────
router.get('/news',        wrap(contentCtrl.listNews));
router.post('/news',       wrap(contentCtrl.createNews));
router.put('/news/:id',    wrap(contentCtrl.updateNews));
router.delete('/news/:id', wrap(contentCtrl.deleteNews));

// ─── Content: FAQ — /faq/reorder must come before /faq/:id ──────────────────
router.get('/faq',           wrap(contentCtrl.listFaq));
router.post('/faq',          wrap(contentCtrl.createFaq));
router.put('/faq/reorder',   wrap(contentCtrl.reorderFaq));
router.put('/faq/:id',       wrap(contentCtrl.updateFaq));
router.delete('/faq/:id',    wrap(contentCtrl.deleteFaq));

// ─── Content: Giveaways ──────────────────────────────────────────────────────
router.get('/giveaways',               wrap(contentCtrl.listGiveaways));
router.post('/giveaways',              wrap(contentCtrl.createGiveaway));
router.put('/giveaways/:id',           wrap(contentCtrl.updateGiveaway));
router.delete('/giveaways/:id',        wrap(contentCtrl.deleteGiveaway));
router.get('/giveaways/:id/entries',   wrap(contentCtrl.getGiveawayEntries));

// ─── Sweeps ───────────────────────────────────────────────────────────────────
router.post('/eth/sweep',              wrap(ethCtrl.sweepEth));
router.post('/utxo/sweep/:currency',   wrap(utxoCtrl.sweepUtxo));

// ─── Analytics ───────────────────────────────────────────────────────────────
router.get('/analytics', wrap(analyticsCtrl.getAnalytics));

// ─── Catalog lookups (for product form dropdowns) ─────────────────────────────
router.get('/categories', wrap(categoriesCtrl.list));
router.get('/brands',     wrap(brandsCtrl.list));

// ─── Settings ────────────────────────────────────────────────────────────────
router.get('/settings',                    wrap(settingsCtrl.getAllSettings));
router.put('/settings',                    wrap(settingsCtrl.updateSettings));
router.get('/system-status',               wrap(settingsCtrl.getSystemStatus));
router.put('/system-status/:id',           wrap(settingsCtrl.updateSystemStatus));
router.get('/system-status/incidents',     wrap(settingsCtrl.listIncidents));
router.post('/system-status/incidents',    wrap(settingsCtrl.createIncident));
router.put('/system-status/incidents/:id', wrap(settingsCtrl.updateIncident));
router.delete('/system-status/incidents/:id', wrap(settingsCtrl.deleteIncident));

module.exports = router;
