const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/brands.controller');

const router = Router();

router.get('/',    ctrl.list);

router.post('/',   requireAuth, requireAdmin, ctrl.create);
router.put('/:id', requireAuth, requireAdmin, ctrl.update);
router.delete('/:id', requireAuth, requireAdmin, ctrl.remove);

module.exports = router;
