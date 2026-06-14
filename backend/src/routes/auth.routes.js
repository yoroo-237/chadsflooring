const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const { register, login, refresh, logout } = require('../controllers/auth.controller');

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login',    validate(loginSchema),    login);
router.post('/refresh',  refresh);
router.post('/logout',   requireAuth,              logout);

module.exports = router;
