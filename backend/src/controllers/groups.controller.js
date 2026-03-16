const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const Group = require('../models/Group');

const createGroup = asyncHandler(async (req, res) => {
  const { name, description, isPublic, media } = req.body;
  if (!name) throw new AppError('name is required', 400);

  const doc = await Group.create({
    name,
    description: description || '',
    isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
    media: media || { url: '', publicId: '', resourceType: '' },
    createdBy: req.user._id,
    members: [{ user: req.user._id, role: 'owner', joinedAt: new Date() }],
  });

  res.status(201).json({ ok: true, group: doc });
});

const listGroups = asyncHandler(async (req, res) => {
  const { q, isPublic, page = 1, limit = 20 } = req.query;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const filter = {};
  if (isPublic !== undefined) filter.isPublic = String(isPublic) === 'true';
  if (q) filter.$text = { $search: String(q) };

  const [items, total] = await Promise.all([
    Group.find(filter)
      .populate('createdBy', 'name membershipId profilePicture')
      .populate('members.user', 'name membershipId profilePicture role status')
      .populate('joinRequests.user', 'name membershipId profilePicture role status')
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l),
    Group.countDocuments(filter),
  ]);

  res.json({ ok: true, page: p, limit: l, total, items });
});

const getGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const group = await Group.findById(id).populate('createdBy', 'name membershipId profilePicture');
  if (!group) throw new AppError('Group not found', 404);

  if (!group.isPublic) {
    const isMember = (group.members || []).some((m) => String(m.user) === String(req.user._id));
    if (!isMember && req.user.role !== 'admin') throw new AppError('Forbidden', 403);
  }

  res.json({ ok: true, group });
});

function isGroupOwnerOrAdmin(group, user) {
  if (user.role === 'admin') return true;
  if (String(group.createdBy) === String(user._id)) return true;
  const ownerMember = (group.members || []).find((m) => String(m.user) === String(user._id) && m.role === 'owner');
  return Boolean(ownerMember);
}

const requestAccess = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const group = await Group.findById(id);
  if (!group) throw new AppError('Group not found', 404);

  group.members = group.members || [];
  group.joinRequests = group.joinRequests || [];
  group.blockedUsers = group.blockedUsers || [];

  const isBlocked = (group.blockedUsers || []).some((u) => String(u) === String(req.user._id));
  if (isBlocked) throw new AppError('You are blocked from this group', 403);

  if (group.isPublic) {
    return res.status(400).json({ ok: false, message: 'Group is public; join directly' });
  }

  const isMember = (group.members || []).some((m) => String(m.user) === String(req.user._id));
  if (isMember) return res.json({ ok: true, group });

  const already = (group.joinRequests || []).some((r) => String(r.user) === String(req.user._id));
  if (!already) {
    group.joinRequests.push({ user: req.user._id, requestedAt: new Date() });
    await group.save();
  }

  const populated = await Group.findById(group._id)
    .populate('createdBy', 'name membershipId profilePicture')
    .populate('members.user', 'name membershipId profilePicture role status')
    .populate('joinRequests.user', 'name membershipId profilePicture role status');

  res.json({ ok: true, group: populated });
});

const blockJoinRequester = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const group = await Group.findById(id);
  if (!group) throw new AppError('Group not found', 404);

  group.members = group.members || [];
  group.joinRequests = group.joinRequests || [];
  group.blockedUsers = group.blockedUsers || [];

  if (!isGroupOwnerOrAdmin(group, req.user)) throw new AppError('Forbidden', 403);

  const alreadyBlocked = (group.blockedUsers || []).some((u) => String(u) === String(userId));
  if (!alreadyBlocked) group.blockedUsers.push(userId);

  group.joinRequests = (group.joinRequests || []).filter((r) => String(r.user) !== String(userId));
  await group.save();

  const populated = await Group.findById(group._id)
    .populate('createdBy', 'name membershipId profilePicture')
    .populate('members.user', 'name membershipId profilePicture role status')
    .populate('joinRequests.user', 'name membershipId profilePicture role status');

  res.json({ ok: true, group: populated });
});

const listAllJoinRequestsAdmin = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new AppError('Forbidden', 403);

  const { q } = req.query;
  const filter = { joinRequests: { $exists: true, $ne: [] } };
  if (q) filter.$text = { $search: String(q) };

  const groups = await Group.find(filter)
    .select('name isPublic createdBy joinRequests blockedUsers createdAt')
    .populate('createdBy', 'name membershipId profilePicture')
    .populate('joinRequests.user', 'name membershipId profilePicture role status')
    .sort({ createdAt: -1 });

  const items = [];
  for (const g of groups) {
    for (const r of g.joinRequests || []) {
      items.push({
        group: { _id: g._id, name: g.name, isPublic: g.isPublic, createdBy: g.createdBy },
        request: r,
      });
    }
  }

  items.sort((a, b) => {
    const at = new Date(a.request.requestedAt || 0).getTime();
    const bt = new Date(b.request.requestedAt || 0).getTime();
    return bt - at;
  });

  res.json({ ok: true, items });
});

const listJoinRequests = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const group = await Group.findById(id).populate('joinRequests.user', 'name membershipId profilePicture role status');
  if (!group) throw new AppError('Group not found', 404);

  group.members = group.members || [];
  group.joinRequests = group.joinRequests || [];

  if (!isGroupOwnerOrAdmin(group, req.user)) throw new AppError('Forbidden', 403);

  res.json({ ok: true, items: group.joinRequests || [] });
});

const approveJoinRequest = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const group = await Group.findById(id);
  if (!group) throw new AppError('Group not found', 404);

  group.members = group.members || [];
  group.joinRequests = group.joinRequests || [];

  if (!isGroupOwnerOrAdmin(group, req.user)) throw new AppError('Forbidden', 403);

  const requested = (group.joinRequests || []).some((r) => String(r.user) === String(userId));
  if (!requested) throw new AppError('Join request not found', 404);

  const isMember = (group.members || []).some((m) => String(m.user) === String(userId));
  if (!isMember) {
    group.members.push({ user: userId, role: 'member', joinedAt: new Date() });
  }

  group.joinRequests = group.joinRequests.filter((r) => String(r.user) !== String(userId));
  await group.save();

  const populated = await Group.findById(group._id)
    .populate('createdBy', 'name membershipId profilePicture')
    .populate('members.user', 'name membershipId profilePicture role status')
    .populate('joinRequests.user', 'name membershipId profilePicture role status');

  res.json({ ok: true, group: populated });
});

const denyJoinRequest = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const group = await Group.findById(id);
  if (!group) throw new AppError('Group not found', 404);

  group.joinRequests = group.joinRequests || [];

  if (!isGroupOwnerOrAdmin(group, req.user)) throw new AppError('Forbidden', 403);

  const before = group.joinRequests.length;
  group.joinRequests = group.joinRequests.filter((r) => String(r.user) !== String(userId));
  if (group.joinRequests.length === before) throw new AppError('Join request not found', 404);
  await group.save();

  const populated = await Group.findById(group._id)
    .populate('createdBy', 'name membershipId profilePicture')
    .populate('members.user', 'name membershipId profilePicture role status')
    .populate('joinRequests.user', 'name membershipId profilePicture role status');

  res.json({ ok: true, group: populated });
});

const joinGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const group = await Group.findById(id);
  if (!group) throw new AppError('Group not found', 404);

  const isBlocked = (group.blockedUsers || []).some((u) => String(u) === String(req.user._id));
  if (isBlocked) throw new AppError('You are blocked from this group', 403);

  const isMember = group.members.some((m) => String(m.user) === String(req.user._id));
  if (isMember) return res.json({ ok: true, group });

  if (!group.isPublic && req.user.role !== 'admin') {
    throw new AppError('Group is private. Request access to join.', 403);
  }

  group.members.push({ user: req.user._id, role: 'member', joinedAt: new Date() });
  await group.save();

  res.json({ ok: true, group });
});

const leaveGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const group = await Group.findById(id);
  if (!group) throw new AppError('Group not found', 404);

  group.members = group.members.filter((m) => String(m.user) !== String(req.user._id));
  await group.save();

  res.json({ ok: true, group });
});

const deleteGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const group = await Group.findById(id);
  if (!group) throw new AppError('Group not found', 404);

  const isOwner = String(group.createdBy) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') throw new AppError('Forbidden', 403);

  await Group.deleteOne({ _id: group._id });
  res.json({ ok: true });
});

module.exports = {
  createGroup,
  listGroups,
  getGroup,
  joinGroup,
  requestAccess,
  listJoinRequests,
  approveJoinRequest,
  denyJoinRequest,
  blockJoinRequester,
  listAllJoinRequestsAdmin,
  leaveGroup,
  deleteGroup,
};
