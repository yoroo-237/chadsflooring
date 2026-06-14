const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/categories.controller');

const router = Router();

router.get('/',     ctrl.list);
router.get('/:slug', ctrl.getOne);

router.post('/',    requireAuth, requireAdmin, ctrl.create);
router.put('/:id',  requireAuth, requireAdmin, ctrl.update);
router.delete('/:id', requireAuth, requireAdmin, ctrl.remove);

module.exports = router;
