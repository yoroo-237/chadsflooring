const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/wishlist.controller');

const router = Router();

router.get('/',              requireAuth, ctrl.getWishlist);
router.post('/:productId',   requireAuth, ctrl.toggle);
router.delete('/:productId', requireAuth, ctrl.remove);

module.exports = router;
