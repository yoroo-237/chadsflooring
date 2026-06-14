const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/team.controller');

const router = Router();

router.get('/',              requireAuth, ctrl.getTeam);
router.post('/invite',       requireAuth, ctrl.inviteMember);
router.delete('/members/:id', requireAuth, ctrl.removeMember);

module.exports = router;
