const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/notifications.controller');

const router = Router();

// read-all registered before /:id/read to avoid ambiguity
router.patch('/read-all', requireAuth, ctrl.markAllRead);
router.get('/',           requireAuth, ctrl.list);
router.patch('/:id/read', requireAuth, ctrl.markRead);

module.exports = router;
