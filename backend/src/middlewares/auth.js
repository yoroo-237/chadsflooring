const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../db');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  next();
}

async function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key.length < 6) {
    return res.status(401).json({ success: false, error: 'API key required.' });
  }

  const keyPrefix = key.slice(0, 6);

  const apiKey = await prisma.apiKey.findFirst({
    where: { keyPrefix, isActive: true },
  });

  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'Invalid API key.' });
  }

  const valid = await bcrypt.compare(key, apiKey.keyHash);
  if (!valid) {
    return res.status(401).json({ success: false, error: 'Invalid API key.' });
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  });

  req.apiKeyUserId = apiKey.userId;
  next();
}

// Reads the token if present but never blocks — sets req.user if valid
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    } catch {
      // invalid / expired token — just proceed without user
    }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireApiKey, optionalAuth };
