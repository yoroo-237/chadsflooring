const { Router } = require('express');
const { optionalAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createTicketSchema } = require('../validators/support.validator');
const { requireService } = require('../middlewares/maintenance');
const ctrl = require('../controllers/support.controller');

const router = Router();

router.get('/tickets',                 optionalAuth, ctrl.listTickets);
router.post('/tickets',                optionalAuth, requireService('Support System', 'Support is temporarily unavailable. Please try again later.'), validate(createTicketSchema), ctrl.createTicket);
router.get('/tickets/:id',             optionalAuth, ctrl.getTicket);
router.post('/tickets/:id/messages',   optionalAuth, ctrl.createMessage);
router.patch('/tickets/:id/close',     optionalAuth, ctrl.closeTicket);

module.exports = router;
