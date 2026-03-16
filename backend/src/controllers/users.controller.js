const bcrypt = require('bcryptjs');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const User = require('../models/User');

const getMe = asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    user: req.user,
  });
});

const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'profilePicture', 'digitalId', 'district', 'constituency', 'address'];
  const patch = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }

  const user = await User.findByIdAndUpdate(req.user._id, patch, { new: true }).select('-passwordHash -refreshTokenHash');
  res.json({ ok: true, user });
});

const adminCreateUser = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  if (!name || !email) throw new AppError('name and email are required', 400);

  const normalizedEmail = String(email).toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new AppError('Email already exists', 409);

  let passwordHash;
  let authProvider = 'google';
  if (password) {
    passwordHash = await bcrypt.hash(password, 12);
    authProvider = 'local';
  }

  const doc = await User.create({
    name,
    email: normalizedEmail,
    phone: phone || '',
    role: role === 'admin' ? 'admin' : 'user',
    status: 'active',
    authProvider,
    passwordHash,
  });

  res.status(201).json({ ok: true, user: doc });
});

const adminDeleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (String(id) === String(req.user._id)) throw new AppError('Cannot delete self', 400);

  const doc = await User.findByIdAndDelete(id);
  if (!doc) throw new AppError('User not found', 404);
  res.json({ ok: true });
});

const adminSetStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['active', 'blocked'].includes(status)) throw new AppError('Invalid status', 400);

  const doc = await User.findByIdAndUpdate(id, { status }, { new: true }).select('-passwordHash -refreshTokenHash');
  if (!doc) throw new AppError('User not found', 404);
  res.json({ ok: true, user: doc });
});

const listUsers = asyncHandler(async (req, res) => {
  const { q, role, status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { name: { $regex: String(q), $options: 'i' } },
      { email: { $regex: String(q), $options: 'i' } },
      { membershipId: { $regex: String(q), $options: 'i' } },
      { phone: { $regex: String(q), $options: 'i' } },
    ];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash -refreshTokenHash')
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l),
    User.countDocuments(filter),
  ]);

  res.json({ ok: true, page: p, limit: l, total, items });
});

const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await User.findById(id).select('-passwordHash -refreshTokenHash');
  if (!doc) throw new AppError('User not found', 404);
  res.json({ ok: true, user: doc });
});

const directory = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 50 } = req.query;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

  const filter = { status: 'active' };
  if (q) {
    filter.$or = [
      { name: { $regex: String(q), $options: 'i' } },
      { membershipId: { $regex: String(q), $options: 'i' } },
      { phone: { $regex: String(q), $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('name membershipId profilePicture role district constituency phone email status createdAt')
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l),
    User.countDocuments(filter),
  ]);

  res.json({ ok: true, page: p, limit: l, total, items });
});

module.exports = {
  getMe,
  updateMe,
  adminCreateUser,
  adminDeleteUser,
  adminSetStatus,
  listUsers,
  getUserById,
  directory,
};
