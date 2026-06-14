const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const { comparePassword, hashPassword, validatePasswordStrength } = require('../services/auth.service');

const TIERS = [
  { name: 'basic',     minSpent: 0    },
  { name: 'preferred', minSpent: 1000 },
  { name: 'gold',      minSpent: 2000 },
  { name: 'platinum',  minSpent: 5000 },
];

function resolveTier(totalSpent) {
  const spent = parseFloat(totalSpent);
  let tier = TIERS[0];
  for (const t of TIERS) if (spent >= t.minSpent) tier = t;
  return tier.name;
}

async function getProfile(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return error(res, 'User not found.', 404);

  return success(res, {
    id:               user.id,
    username:         user.username,
    markupPct:        parseFloat(user.markupPct),
    signalDetails:    user.signalDetails,
    sessionDetails:   user.sessionDetails,
    btcRefundAddress: user.btcRefundAddress,
    xmrRefundAddress: user.xmrRefundAddress,
    telegramHandle:   user.telegramHandle,
    avatarUrl:        user.avatarUrl,
    bio:              user.bio,
    role:             user.role,
    balance:          parseFloat(user.balance),
    points:           user.points,
    totalSpent:       parseFloat(user.totalSpent),
    tier:             resolveTier(user.totalSpent),
    tourCompleted:    user.tourCompleted,
    hidePrices:       user.hidePrices,
    notifOrders:      user.notifOrders,
    notifDeposits:    user.notifDeposits,
    notifTickets:     user.notifTickets,
    notifNewProducts: user.notifNewProducts,
    notifLogins:      user.notifLogins,
    createdAt:        user.createdAt,
    lastLoginAt:      user.lastLoginAt,
  });
}

async function updateProfile(req, res) {
  const {
    username, signalDetails, sessionDetails, btcRefundAddress,
    xmrRefundAddress, telegramHandle, bio, markupPct,
  } = req.body;

  if (markupPct !== undefined && req.user.role !== 'admin') {
    return error(res, 'Only admins can modify markupPct.', 403);
  }

  const data = {};
  if (username         !== undefined) data.username         = username;
  if (signalDetails    !== undefined) data.signalDetails    = signalDetails;
  if (sessionDetails   !== undefined) data.sessionDetails   = sessionDetails;
  if (btcRefundAddress !== undefined) data.btcRefundAddress = btcRefundAddress;
  if (xmrRefundAddress !== undefined) data.xmrRefundAddress = xmrRefundAddress;
  if (telegramHandle   !== undefined) data.telegramHandle   = telegramHandle;
  if (bio              !== undefined) data.bio              = bio;
  if (markupPct        !== undefined) data.markupPct        = markupPct;

  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  return success(res, { updated: true, username: user.username });
}

async function uploadAvatar(req, res) {
  if (!req.file) return error(res, 'No file uploaded.', 400);

  let avatarUrl;

  if (process.env.CLOUDINARY_CLOUD_NAME) {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder:         'canna-express/avatars',
      transformation: [{ width: 300, height: 300, crop: 'fill' }],
    });
    avatarUrl = result.secure_url;
  } else {
    avatarUrl = `/uploads/${req.file.filename}`;
  }

  await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl } });
  return success(res, { avatarUrl });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return error(res, 'currentPassword and newPassword are required.', 400);
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) return error(res, 'Current password is incorrect.', 401);

  const strength = validatePasswordStrength(newPassword);
  if (!strength.isValid) {
    return res.status(400).json({ success: false, error: 'Password too weak.', rules: strength.rules });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
  return success(res, { updated: true });
}

async function completeTour(req, res) {
  await prisma.user.update({ where: { id: req.user.id }, data: { tourCompleted: true } });
  return success(res, { tourCompleted: true });
}

function get2fa(req, res) {
  return success(res, { enabled: false });
}

function enable2fa(req, res) {
  return res.status(501).json({ success: false, error: 'Not implemented.' });
}

function disable2fa(req, res) {
  return res.status(501).json({ success: false, error: 'Not implemented.' });
}

async function getNotifSettings(req, res) {
  const user = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: {
      notifOrders: true, notifDeposits: true, notifTickets: true,
      notifNewProducts: true, notifLogins: true,
    },
  });
  return success(res, user);
}

async function updateNotifSettings(req, res) {
  const { notifOrders, notifDeposits, notifTickets, notifNewProducts, notifLogins } = req.body;
  const data = {};
  if (notifOrders      !== undefined) data.notifOrders      = notifOrders;
  if (notifDeposits    !== undefined) data.notifDeposits    = notifDeposits;
  if (notifTickets     !== undefined) data.notifTickets     = notifTickets;
  if (notifNewProducts !== undefined) data.notifNewProducts = notifNewProducts;
  if (notifLogins      !== undefined) data.notifLogins      = notifLogins;

  await prisma.user.update({ where: { id: req.user.id }, data });
  return success(res, { updated: true });
}

module.exports = {
  getProfile, updateProfile, uploadAvatar, changePassword, completeTour,
  get2fa, enable2fa, disable2fa, getNotifSettings, updateNotifSettings,
};
