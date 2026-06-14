const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');

const TEAM_LIMIT = 10;

async function getTeam(req, res) {
  const ownerId = req.user.sub;

  const [owner, members] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: ownerId },
      select: { username: true, markupPct: true },
    }),
    prisma.teamMember.findMany({
      where:   { ownerId },
      orderBy: { invitedAt: 'desc' },
      include: { member: { select: { id: true, username: true } } },
    }),
  ]);

  if (!owner) return error(res, 'User not found.', 404);

  return success(res, {
    owner: {
      username:  owner.username,
      markupPct: parseFloat(owner.markupPct),
    },
    members: members.map(m => ({
      id:             m.id,
      inviteUsername: m.inviteUsername,
      status:         m.status,
      memberId:       m.memberId   ?? null,
      memberUsername: m.member?.username ?? null,
      invitedAt:      m.invitedAt,
      joinedAt:       m.joinedAt   ?? null,
    })),
    totalMembers: members.length,
  });
}

async function inviteMember(req, res) {
  const ownerId = req.user.sub;
  const { username } = req.body;

  if (!username?.trim()) {
    return error(res, 'A username is required.', 400);
  }

  const [existing, count] = await Promise.all([
    prisma.teamMember.findFirst({ where: { ownerId, inviteUsername: username } }),
    prisma.teamMember.count({ where: { ownerId } }),
  ]);

  if (existing) {
    return error(res, 'This user is already in your team.', 409);
  }
  if (count >= TEAM_LIMIT) {
    return res.status(422).json({ success: false, error: `Team limit of ${TEAM_LIMIT} members reached.` });
  }

  const linkedUser = await prisma.user.findUnique({ where: { username } });

  const member = await prisma.teamMember.create({
    data: {
      ownerId,
      inviteUsername: username,
      status:         linkedUser ? 'active'  : 'pending',
      memberId:       linkedUser ? linkedUser.id : null,
      joinedAt:       linkedUser ? new Date() : null,
    },
    include: { member: { select: { id: true, username: true } } },
  });

  return success(res, { member }, 201);
}

async function removeMember(req, res) {
  const ownerId = req.user.sub;
  const id      = parseInt(req.params.id);

  const member = await prisma.teamMember.findFirst({ where: { id, ownerId } });
  if (!member) return error(res, 'Member not found.', 404);

  await prisma.teamMember.delete({ where: { id } });
  return success(res, { removed: true });
}

module.exports = { getTeam, inviteMember, removeMember };
