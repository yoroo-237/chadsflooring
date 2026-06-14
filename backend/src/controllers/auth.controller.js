const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const {
  generateTokens,
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generatePasswordResetToken,
} = require('../services/auth.service');
const { sendPasswordResetEmail } = require('../services/mail.service');

const WELCOME_NOTIFICATIONS = [
  { type: 'welcome', title: 'Welcome! Browse our latest products.' },
  { type: 'product', title: 'New arrivals in Accessories!'         },
  { type: 'stock',   title: 'Limited stock on Focus V Aeris Kit.'  },
];

// POST /api/auth/register
async function register(req, res) {
  const { username, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return error(res, 'Email already in use.', 409);
  }

  const strength = validatePasswordStrength(password);
  if (!strength.isValid) {
    return error(res, 'Password is too weak.', 400);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { username, email, passwordHash },
  });

  await prisma.notification.createMany({
    data: WELCOME_NOTIFICATIONS.map(n => ({ ...n, userId: user.id })),
  });

  const { accessToken, refreshToken } = generateTokens(user);

  return success(res, {
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
    token: accessToken,
    refreshToken,
  }, 201);
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return error(res, 'Invalid credentials.', 401);
  }

  if (!user.isActive) {
    return error(res, 'Account banned.', 403);
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return error(res, 'Invalid credentials.', 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { lastLoginAt: new Date() },
  });

  const { accessToken, refreshToken } = generateTokens(user);

  return success(res, {
    user: {
      id:      user.id,
      username: user.username,
      email:   user.email,
      role:    user.role,
      balance: user.balance,
      points:  user.points,
    },
    token: accessToken,
    refreshToken,
  });
}

// POST /api/auth/refresh
async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return error(res, 'Refresh token required.', 400);
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return error(res, 'Invalid or expired refresh token.', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    return error(res, 'User not found.', 401);
  }

  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  return success(res, { token: accessToken });
}

// POST /api/auth/logout
function logout(req, res) {
  return success(res, { message: 'Logged out successfully.' });
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  const { email } = req.body;

  // Always return 200 regardless of whether the email exists (security)
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const resetToken  = generatePasswordResetToken();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken:  resetToken,
        passwordResetExpiry: resetExpiry,
      },
    });

    await sendPasswordResetEmail(email, resetToken);
  }

  return success(res, { message: 'If this email exists, a reset link was sent.' });
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  const { token, password } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken:  token,
      passwordResetExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    return error(res, 'Invalid or expired reset token.', 400);
  }

  const strength = validatePasswordStrength(password);
  if (!strength.isValid) {
    return error(res, 'Password is too weak.', 400);
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken:  null,
      passwordResetExpiry: null,
    },
  });

  return success(res, { message: 'Password updated successfully.' });
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword };
