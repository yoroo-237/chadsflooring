const { Router } = require('express');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/content.controller');

const router = Router();

router.get('/news',                  ctrl.getNews);
router.get('/faq',                   ctrl.getFaq);
router.get('/giveaways',             optionalAuth, ctrl.getGiveaways);
router.post('/giveaways/:id/enter',  requireAuth,  ctrl.enterGiveaway);
router.get('/system-status',         ctrl.getSystemStatus);
router.get('/settings',              ctrl.getSettings);

module.exports = router;
