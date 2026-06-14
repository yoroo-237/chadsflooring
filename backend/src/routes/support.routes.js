const { Router } = require('express');
const { optionalAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createTicketSchema } = require('../validators/support.validator');
const ctrl = require('../controllers/support.controller');

const router = Router();

router.get('/tickets',                 optionalAuth, ctrl.listTickets);
router.post('/tickets',                optionalAuth, validate(createTicketSchema), ctrl.createTicket);
router.get('/tickets/:id',             optionalAuth, ctrl.getTicket);
router.post('/tickets/:id/messages',   optionalAuth, ctrl.createMessage);
router.patch('/tickets/:id/close',     optionalAuth, ctrl.closeTicket);

module.exports = router;
