const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');

async function getAllSettings(req, res) {
  const rows = await prisma.siteSetting.findMany({ orderBy: { key: 'asc' } });
  return success(res, { settings: Object.fromEntries(rows.map(r => [r.key, r.value])) });
}

async function updateSettings(req, res) {
  const updates = req.body;
  if (typeof updates !== 'object' || Array.isArray(updates) || updates === null) {
    return error(res, 'Body must be an object of { key: value } pairs.', 400);
  }

  await prisma.$transaction(
    Object.entries(updates).map(([key, value]) =>
      prisma.siteSetting.upsert({
        where:  { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )
  );
  return success(res, { updated: true });
}

async function getSystemStatus(req, res) {
  const [services, incidents] = await prisma.$transaction([
    prisma.systemStatus.findMany({ orderBy: { service: 'asc' } }),
    prisma.systemIncident.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  return success(res, { services, incidents });
}

async function updateSystemStatus(req, res) {
  const id = parseInt(req.params.id);
  const { status, uptimePct, description } = req.body;

  const existing = await prisma.systemStatus.findUnique({ where: { id } });
  if (!existing) return error(res, 'Service not found.', 404);

  const data = {};
  if (status      !== undefined) data.status      = status;
  if (uptimePct   !== undefined) data.uptimePct   = uptimePct;
  if (description !== undefined) data.description = description;

  const updated = await prisma.systemStatus.update({ where: { id }, data });
  return success(res, updated);
}

async function createIncident(req, res) {
  const { dateLabel, title, status, description } = req.body;

  if (!dateLabel?.trim() || !title?.trim()) {
    return error(res, 'dateLabel and title are required.', 400);
  }

  const incident = await prisma.systemIncident.create({
    data: {
      dateLabel:   dateLabel.trim(),
      title:       title.trim(),
      status:      status       ?? 'resolved',
      description: description  ?? '',
    },
  });
  return success(res, incident, 201);
}

async function listIncidents(req, res) {
  const incidents = await prisma.systemIncident.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return success(res, { incidents });
}

async function deleteIncident(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.systemIncident.findUnique({ where: { id } });
  if (!existing) return error(res, 'Incident not found.', 404);
  await prisma.systemIncident.delete({ where: { id } });
  return success(res, { deleted: true });
}

async function updateIncident(req, res) {
  const id = parseInt(req.params.id);
  const { dateLabel, title, status, description } = req.body;
  const existing = await prisma.systemIncident.findUnique({ where: { id } });
  if (!existing) return error(res, 'Incident not found.', 404);
  const data = {};
  if (dateLabel   !== undefined) data.dateLabel   = dateLabel;
  if (title       !== undefined) data.title       = title;
  if (status      !== undefined) data.status      = status;
  if (description !== undefined) data.description = description;
  const updated = await prisma.systemIncident.update({ where: { id }, data });
  return success(res, updated);
}

module.exports = {
  getAllSettings, updateSettings,
  getSystemStatus, updateSystemStatus,
  listIncidents, createIncident, updateIncident, deleteIncident,
};
