const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');

const CHARSET = '0123456789abcdefghijklmnopqrstuvwxyz';

function generateRawKey() {
  const bytes = crypto.randomBytes(32);
  let suffix = '';
  for (const b of bytes) suffix += CHARSET[b % CHARSET.length];
  return 'sk-' + suffix.substring(0, 32); // 'sk-' + 32 chars = 35 total
}

async function list(req, res) {
  const keys = await prisma.apiKey.findMany({
    where:   { userId: req.user.id, isActive: true },
    select:  { id: true, keyPrefix: true, label: true, lastUsed: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return success(res, { keys });
}

async function create(req, res) {
  const { label = 'Default Key' } = req.body;
  const rawKey   = generateRawKey();
  const keyPrefix = rawKey.substring(0, 6);
  const keyHash  = await bcrypt.hash(rawKey, 10);

  const key = await prisma.apiKey.create({
    data: { userId: req.user.id, keyHash, keyPrefix, label },
  });

  return success(res, {
    id:        key.id,
    prefix:    keyPrefix,
    key:       rawKey,
    label:     key.label,
    createdAt: key.createdAt,
  }, 201);
}

async function remove(req, res) {
  const id = parseInt(req.params.id);
  const key = await prisma.apiKey.findFirst({ where: { id, userId: req.user.id } });
  if (!key) return error(res, 'API key not found.', 404);

  await prisma.apiKey.delete({ where: { id } });
  return success(res, { deleted: true });
}

module.exports = { list, create, remove };
