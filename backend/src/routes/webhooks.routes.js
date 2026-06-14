const { Router } = require('express');
const ctrl = require('../controllers/webhooks.controller');

const router = Router();

router.post('/blockcypher', ctrl.blockcypher);
router.post('/alchemy',     ctrl.alchemy);

module.exports = router;
