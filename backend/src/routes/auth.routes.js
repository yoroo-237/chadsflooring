const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const {
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
} = require('../validators/auth.validator');
const {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
} = require('../controllers/auth.controller');

const router = Router();

router.post('/register',        validate(registerSchema), register);
router.post('/login',           validate(loginSchema),    login);
router.post('/refresh',         refresh);
router.post('/logout',          requireAuth,              logout);
router.post('/forgot-password', validate(forgotSchema),   forgotPassword);
router.post('/reset-password',  validate(resetSchema),    resetPassword);

module.exports = router;
