const { AppError } = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('Unauthorized', 401));
  }
  try {
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.sub).select('-passwordHash');
    if (!user) return next(new AppError('Unauthorized', 401));
    if (user.status === 'blocked') return next(new AppError('Account blocked', 403));

    req.user = user;
    return next();
  } catch (e) {
    return next(new AppError('Unauthorized', 401));
  }
}

async function tryAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub).select('-passwordHash');
    if (user && user.status !== 'blocked') {
      req.user = user;
    }
  } catch {
    // ignore invalid token
  }

  return next();
}

function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    if (!roles.includes(req.user.role)) return next(new AppError('Forbidden', 403));
    return next();
  };
}

module.exports = { requireAuth, tryAuth, requireRole };
