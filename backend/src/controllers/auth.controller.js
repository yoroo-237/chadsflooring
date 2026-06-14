const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const {
  generateTokens,
  hashPassword,
  comparePassword,
  validatePasswordStrength,
} = require('../services/auth.service');

const WELCOME_NOTIFICATIONS = [
  { type: 'welcome', title: 'Welcome! Browse our latest products.' },
  { type: 'product', title: 'New arrivals in Accessories!'         },
  { type: 'stock',   title: 'Limited stock on Focus V Aeris Kit.'  },
];

// POST /api/auth/register
async function register(req, res) {
  const { username, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return error(res, 'Username already taken.', 409);
  }

  const strength = validatePasswordStrength(password);
  if (!strength.isValid) {
    return error(res, 'Password is too weak.', 400);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { username, passwordHash },
  });

  await prisma.notification.createMany({
    data: WELCOME_NOTIFICATIONS.map(n => ({ ...n, userId: user.id })),
  });

  const { accessToken, refreshToken } = generateTokens(user);

  return success(res, {
    user: { id: user.id, username: user.username, role: user.role },
    token: accessToken,
    refreshToken,
  }, 201);
}

// POST /api/auth/login
async function login(req, res) {
  const { username, password } = req.body;

  const user = await prisma.user.findUnique({ where: { username } });
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
      id:       user.id,
      username: user.username,
      role:     user.role,
      balance:  user.balance,
      points:   user.points,
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
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  return success(res, { token: accessToken });
}

// POST /api/auth/logout
function logout(req, res) {
  return success(res, { message: 'Logged out successfully.' });
}

module.exports = { register, login, refresh, logout };
