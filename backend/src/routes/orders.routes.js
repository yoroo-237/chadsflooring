const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { placeOrderSchema, payOrderSchema } = require('../validators/order.validator');
const { requireService } = require('../middlewares/maintenance');
const wrap = require('../utils/asyncHandler');
const ctrl = require('../controllers/orders.controller');

const router = Router();

const ordering = requireService('Order Management', 'Ordering is temporarily unavailable. Please try again later.');
const paying   = requireService('Payment Processing', 'Payments are temporarily unavailable. Please try again later.');

router.post('/',                    requireAuth, ordering, paying, validate(placeOrderSchema), wrap(ctrl.checkout));
router.post('/pay',                 requireAuth, ordering, paying, validate(payOrderSchema), wrap(ctrl.pay));
router.get('/payable-coins',        requireAuth, wrap(ctrl.coins));
router.get('/',                     requireAuth, wrap(ctrl.list));
router.get('/:id/payment',          requireAuth, wrap(ctrl.payment));
router.post('/:id/payment/check',   requireAuth, wrap(ctrl.checkPayment));
router.get('/:id',                  requireAuth, wrap(ctrl.getOne));
router.patch('/:id/cancel',         requireAuth, wrap(ctrl.cancel));

module.exports = router;
