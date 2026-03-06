const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

function issueTokens(user) {
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id), role: user.role });
  return { accessToken, refreshToken };
}

async function setRefreshToken(userId, refreshToken) {
  const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
  await User.findByIdAndUpdate(userId, { refreshTokenHash });
}

const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required', 400);

  const user = await User.findOne({ email: String(email).toLowerCase(), role: 'admin' }).select('+passwordHash +refreshTokenHash');
  if (!user) throw new AppError('Invalid credentials', 401);
  if (user.status === 'blocked') throw new AppError('Account blocked', 403);
  if (!user.passwordHash) throw new AppError('Admin account is misconfigured', 500);

  const ok = await user.comparePassword(password);
  if (!ok) throw new AppError('Invalid credentials', 401);

  const { accessToken, refreshToken } = issueTokens(user);
  await setRefreshToken(user._id, refreshToken);

  res.json({
    ok: true,
    admin: {
      id: user._id,
      membershipId: user.membershipId,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    tokens: { accessToken, refreshToken },
  });
});

const adminRefresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 400);

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (e) {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await User.findById(decoded.sub).select('+refreshTokenHash');
  if (!user || user.role !== 'admin') throw new AppError('Invalid refresh token', 401);

  const match = user.refreshTokenHash ? await bcrypt.compare(refreshToken, user.refreshTokenHash) : false;
  if (!match) throw new AppError('Invalid refresh token', 401);

  const { accessToken, refreshToken: newRefresh } = issueTokens(user);
  await setRefreshToken(user._id, newRefresh);

  res.json({ ok: true, tokens: { accessToken, refreshToken: newRefresh } });
});

module.exports = { adminLogin, adminRefresh };
