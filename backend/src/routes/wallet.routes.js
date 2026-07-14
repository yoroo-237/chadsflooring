const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/wallet.controller');

const router = Router();

router.get('/',               requireAuth, ctrl.getWallet);
router.get('/transactions',   requireAuth, ctrl.listTransactions);
router.get('/deposits',       requireAuth, ctrl.listDeposits);
router.get('/deposits/:id',         requireAuth, ctrl.getDeposit);
router.post('/deposits/:id/check',  requireAuth, ctrl.checkDeposit);
router.post('/deposit',             requireAuth, ctrl.createDeposit);

module.exports = router;
