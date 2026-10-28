const jwt = require('jsonwebtoken');
const prisma = require('../db');

// Routes that must stay reachable during maintenance: admin panel + login (so the
// admin can switch it back off), public status/settings (for the maintenance
// screen), payment webhooks (incoming crypto deposits must not be lost).
const ALWAYS_OPEN = ['/api/admin', '/api/auth', '/api/health', '/api/content', '/api/webhooks'];

// SystemStatus values that close a service to customers.
const BLOCKING = ['maintenance', 'major_outage'];

const CACHE_MS = 5000;
let cached = { maintenance: false, blocked: new Set(), at: 0 };

async function load() {
  if (Date.now() - cached.at < CACHE_MS) return cached;
  const [row, services] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: 'maintenance_mode' } }),
    prisma.systemStatus.findMany({ where: { status: { in: BLOCKING } }, select: { service: true } }),
  ]);
  cached = {
    maintenance: row?.value === 'true',
    blocked: new Set(services.map(s => s.service)),
    at: Date.now(),
  };
  return cached;
}

// Called after the admin changes a setting / service status so it applies immediately.
function resetMaintenanceCache() {
  cached = { maintenance: false, blocked: new Set(), at: 0 };
}

// True when customers must see the "under maintenance" screen (global switch, or
// the Website / API service is closed).
async function isStoreClosed() {
  const c = await load();
  return c.maintenance || c.blocked.has('Website') || c.blocked.has('API');
}

function isAdminRequest(req) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return false;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return payload.role === 'admin' || payload.role === 'superadmin';
  } catch {
    return false;
  }
}

function reject(res, error) {
  return res.status(503).json({ success: false, maintenance: true, error });
}

async function maintenanceGuard(req, res, next) {
  try {
    if (ALWAYS_OPEN.some(p => req.originalUrl.startsWith(p))) return next();
    if (!(await isStoreClosed())) return next();
    if (isAdminRequest(req)) return next();
    return reject(res, 'The store is currently under maintenance. Please try again later.');
  } catch {
    next();
  }
}

// Per-feature gate: requireService('Payment Processing', 'Payments are ...')
function requireService(service, message) {
  return async (req, res, next) => {
    try {
      const c = await load();
      if (!c.blocked.has(service)) return next();
      if (isAdminRequest(req)) return next();
      return reject(res, message);
    } catch {
      next();
    }
  };
}

// Same, but only when the request carries the given query param (e.g. product search).
function requireServiceForQuery(service, param, message) {
  const gate = requireService(service, message);
  return (req, res, next) => (req.query[param] ? gate(req, res, next) : next());
}

module.exports = { maintenanceGuard, resetMaintenanceCache, isStoreClosed, requireService, requireServiceForQuery };
