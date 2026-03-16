const bcrypt = require('bcryptjs');
const { passport } = require('../config/passport');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');

const googleOAuthClient = new OAuth2Client();

function issueTokens(user) {
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id), role: user.role });
  return { accessToken, refreshToken };
}

const googleNative = asyncHandler(async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) throw new AppError('idToken is required', 400);

  const audience =
    process.env.GOOGLE_WEB_CLIENT_ID ||
    process.env.WEB_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID;

  if (!audience) {
    throw new AppError('Google audience (GOOGLE_WEB_CLIENT_ID) is not configured', 500);
  }

  let ticket;
  try {
    ticket = await googleOAuthClient.verifyIdToken({
      idToken: String(idToken),
      audience: String(audience),
    });
  } catch (e) {
    throw new AppError('Invalid Google token', 401);
  }

  const payload = ticket.getPayload();
  const email = payload && payload.email;
  const emailVerified = payload && payload.email_verified;

  if (!email) throw new AppError('Google token missing email', 401);
  if (emailVerified === false) throw new AppError('Google email not verified', 401);

  const normalizedEmail = String(email).toLowerCase();
  const googleId = payload && payload.sub;
  const name = (payload && payload.name) || 'User';
  const picture = (payload && payload.picture) || '';

  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    user = await User.create({
      name,
      email: normalizedEmail,
      phone: '',
      profilePicture: picture,
      authProvider: 'google',
      googleId: googleId || undefined,
      role: 'user',
      status: 'active',
    });
  } else {
    if (user.status === 'blocked') throw new AppError('Account blocked', 403);

    if (!user.googleId && googleId) user.googleId = googleId;
    if (!user.profilePicture && picture) user.profilePicture = picture;
    if (user.authProvider !== 'google') user.authProvider = 'google';
    await user.save();
  }

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

      const payload = {
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
      };

      const frontendBase =
        process.env.FRONTEND_URL ||
        process.env.PUBLIC_FRONTEND_URL ||
        process.env.FULL_FRONTEND_URL;

      if (frontendBase) {
        const redirectUrl = new URL('/auth/google', String(frontendBase));
        redirectUrl.searchParams.set('payload', Buffer.from(JSON.stringify(payload)).toString('base64'));
        return res.redirect(302, redirectUrl.toString());
      }

      return res.json(payload);
    } catch (e) {
      return next(e);
    }
  })(req, res, next);
};

const registerLocal = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) throw new AppError('Name, email and password are required', 400);
  if (String(password).length < 6) throw new AppError('Password must be at least 6 characters', 400);

  const emailNorm = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: emailNorm });
  if (existing) throw new AppError('Email already registered', 409);

  const passwordHash = await bcrypt.hash(String(password), 12);
  const user = await User.create({
    name: String(name).trim(),
    email: emailNorm,
    phone: '',
    role: 'user',
    status: 'active',
    authProvider: 'local',
    passwordHash,
  });

  const { accessToken, refreshToken } = issueTokens(user);
  await setRefreshToken(user._id, refreshToken);

  res.status(201).json({
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
  googleNative,
  registerLocal,
  loginLocal,
  refresh,
  logout,
};
