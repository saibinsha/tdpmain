const mongoose = require('mongoose');

const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const Message = require('../models/Message');
const User = require('../models/User');

function normalizeLimit(limit) {
  const l = Math.max(1, parseInt(limit, 10) || 50);
  return Math.min(500, l);
}

const listUserPrivateConversations = asyncHandler(async (req, res) => {
  const { userId } = req.query;
  const limit = normalizeLimit(req.query.limit);

  if (!mongoose.Types.ObjectId.isValid(String(userId || ''))) throw new AppError('Invalid userId', 400);

  const uid = String(userId);
  const privateMsgs = await Message.find({
    type: 'private',
    $or: [{ from: uid }, { to: uid }],
  })
    .populate('from', 'name membershipId profilePicture role')
    .sort({ createdAt: -1 })
    .limit(1000);

  const byOther = new Map();
  for (const m of privateMsgs) {
    const other = String(m.from?._id) === uid ? String(m.to) : String(m.from?._id);
    if (!other) continue;
    if (!byOther.has(other)) byOther.set(other, m);
  }

  const otherIds = Array.from(byOther.keys()).slice(0, limit);
  const users = await User.find({ _id: { $in: otherIds } })
    .select('name membershipId profilePicture role status')
    .lean();

  const userById = new Map(users.map((u) => [String(u._id), u]));

  const conversations = otherIds
    .map((id) => {
      const last = byOther.get(id);
      const other = userById.get(String(id));
      if (!other) return null;
      return {
        type: 'private',
        otherUser: other,
        lastMessage: {
          _id: last._id,
          text: last.text,
          media: last.media,
          from: last.from,
          createdAt: last.createdAt,
        },
      };
    })
    .filter(Boolean);

  res.json({ ok: true, items: conversations });
});

const listPrivateConversationMessages = asyncHandler(async (req, res) => {
  const { userId, otherUserId } = req.params;
  const limit = normalizeLimit(req.query.limit);

  if (!mongoose.Types.ObjectId.isValid(userId)) throw new AppError('Invalid userId', 400);
  if (!mongoose.Types.ObjectId.isValid(otherUserId)) throw new AppError('Invalid otherUserId', 400);

  const a = String(userId);
  const b = String(otherUserId);

  const items = await Message.find({
    type: 'private',
    $or: [
      { from: a, to: b },
      { from: b, to: a },
    ],
  })
    .populate('from', 'name membershipId profilePicture role')
    .sort({ createdAt: -1 })
    .limit(limit);

  res.json({ ok: true, items: items.reverse() });
});

module.exports = { listUserPrivateConversations, listPrivateConversationMessages };
