const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { placeOrderSchema } = require('../validators/order.validator');
const { requireService } = require('../middlewares/maintenance');
const ctrl = require('../controllers/orders.controller');

const router = Router();

router.post('/',              requireAuth, requireService('Order Management', 'Ordering is temporarily unavailable. Please try again later.'), requireService('Payment Processing', 'Payments are temporarily unavailable. Please try again later.'), validate(placeOrderSchema), ctrl.checkout);
router.get('/',               requireAuth, ctrl.list);
router.get('/:id',            requireAuth, ctrl.getOne);
router.patch('/:id/cancel',   requireAuth, ctrl.cancel);

module.exports = router;
