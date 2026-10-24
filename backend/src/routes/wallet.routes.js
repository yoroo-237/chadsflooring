const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/wallet.controller');
const wrap = require('../utils/asyncHandler');

const router = Router();

router.get('/',               requireAuth, wrap(ctrl.getWallet));
router.get('/balance',        requireAuth, wrap(ctrl.getWallet));
router.get('/prices',         wrap(ctrl.getPrices));
router.get('/transactions',   requireAuth, wrap(ctrl.listTransactions));
router.get('/deposits',       requireAuth, wrap(ctrl.listDeposits));
router.get('/deposits/:id',         requireAuth, wrap(ctrl.getDeposit));
router.post('/deposits/:id/check',  requireAuth, wrap(ctrl.checkDeposit));
router.post('/deposit',             requireAuth, wrap(ctrl.createDeposit));

module.exports = router;
