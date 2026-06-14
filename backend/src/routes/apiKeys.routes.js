const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/apiKeys.controller');

const router = Router();

router.get('/',       requireAuth, ctrl.list);
router.post('/',      requireAuth, ctrl.create);
router.delete('/:id', requireAuth, ctrl.remove);

module.exports = router;
