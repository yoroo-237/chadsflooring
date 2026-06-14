const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const { uploadAvatar } = require('../middlewares/upload');
const ctrl = require('../controllers/profile.controller');

const router = Router();

router.get('/',                requireAuth, ctrl.getProfile);
router.put('/',                requireAuth, ctrl.updateProfile);
router.post('/avatar',         requireAuth, uploadAvatar, ctrl.uploadAvatar);
router.put('/password',        requireAuth, ctrl.changePassword);
router.patch('/tour-complete', requireAuth, ctrl.completeTour);

router.get('/2fa',             requireAuth, ctrl.get2fa);
router.post('/2fa/enable',     requireAuth, ctrl.enable2fa);
router.post('/2fa/disable',    requireAuth, ctrl.disable2fa);

router.get('/notifications',   requireAuth, ctrl.getNotifSettings);
router.put('/notifications',   requireAuth, ctrl.updateNotifSettings);

module.exports = router;
