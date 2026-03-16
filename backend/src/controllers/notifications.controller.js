const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const User = require('../models/User');

function normalizeToken(token) {
  return String(token || '').trim();
}

const saveToken = asyncHandler(async (req, res) => {
  const { userId, fcmToken } = req.body || {};

  const uid = String(userId || '').trim();
  const token = normalizeToken(fcmToken);

  if (!uid) throw new AppError('userId is required', 400);
  if (!token) throw new AppError('fcmToken is required', 400);

  // Security: do not allow saving a token for a different user.
  if (!req.user || String(req.user._id) !== uid) {
    throw new AppError('Forbidden', 403);
  }

  const updated = await User.findByIdAndUpdate(
    uid,
    { $set: { fcmToken: token } },
    { new: true }
  );

  if (!updated) throw new AppError('User not found', 404);

  res.json({ ok: true });
});

module.exports = {
  saveToken,
};
