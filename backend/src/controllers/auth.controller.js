const bcrypt = require('bcryptjs');
const { passport } = require('../config/passport');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const User = require('../models/User');

function issueTokens(user) {
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id), role: user.role });
  return { accessToken, refreshToken };
}

async function setRefreshToken(userId, refreshToken) {
  const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
  await User.findByIdAndUpdate(userId, { refreshTokenHash });
}

const googleStart = passport.authenticate('google', { scope: ['profile', 'email'], session: false });

const googleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, user) => {
    try {
      if (err) return next(err);
      if (!user) return next(new AppError('Google authentication failed', 401));
      if (user.status === 'blocked') return next(new AppError('Account blocked', 403));

      const { accessToken, refreshToken } = issueTokens(user);
      await setRefreshToken(user._id, refreshToken);

      return res.json({
        ok: true,
        user: {
          id: user._id,
          membershipId: user.membershipId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          profilePicture: user.profilePicture,
          role: user.role,
          status: user.status,
        },
        tokens: { accessToken, refreshToken },
      });
    } catch (e) {
      return next(e);
    }
  })(req, res, next);
};

const loginLocal = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required', 400);

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash +refreshTokenHash');
  if (!user) throw new AppError('Invalid credentials', 401);
  if (user.status === 'blocked') throw new AppError('Account blocked', 403);
  if (user.authProvider !== 'local') throw new AppError('Use Google login for this account', 400);

  const ok = await user.comparePassword(password);
  if (!ok) throw new AppError('Invalid credentials', 401);

  const { accessToken, refreshToken } = issueTokens(user);
  await setRefreshToken(user._id, refreshToken);

  res.json({
    ok: true,
    user: {
      id: user._id,
      membershipId: user.membershipId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profilePicture: user.profilePicture,
      role: user.role,
      status: user.status,
    },
    tokens: { accessToken, refreshToken },
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 400);

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (e) {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await User.findById(decoded.sub).select('+refreshTokenHash');
  if (!user) throw new AppError('Invalid refresh token', 401);
  if (user.status === 'blocked') throw new AppError('Account blocked', 403);

  const match = user.refreshTokenHash ? await bcrypt.compare(refreshToken, user.refreshTokenHash) : false;
  if (!match) throw new AppError('Invalid refresh token', 401);

  const { accessToken, refreshToken: newRefresh } = issueTokens(user);
  await setRefreshToken(user._id, newRefresh);

  res.json({ ok: true, tokens: { accessToken, refreshToken: newRefresh } });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.json({ ok: true });

  try {
    const decoded = verifyRefreshToken(refreshToken);
    await User.findByIdAndUpdate(decoded.sub, { $unset: { refreshTokenHash: 1 } });
  } catch (e) {
    // ignore
  }

  res.json({ ok: true });
});

module.exports = {
  googleStart,
  googleCallback,
  loginLocal,
  refresh,
  logout,
};
