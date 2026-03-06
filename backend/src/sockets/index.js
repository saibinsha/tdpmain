const { Server } = require('socket.io');

const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');

const { registerChatHandlers } = require('./chat');

const onlineUserCounts = new Map();
const offlineTimers = new Map();
const OFFLINE_GRACE_MS = 15000;

function snapshotOnlineUserIds() {
  return Array.from(onlineUserCounts.entries())
    .filter(([, c]) => Number(c) > 0)
    .map(([id]) => String(id));
}

function initSockets(httpServer) {
  function normalizeOrigin(o) {
    return String(o || '').trim().replace(/\/+$/, '');
  }

  const defaultOrigins = [
    'https://telugudeshamparty.onrender.com',
    'http://localhost:3000',
    'http://localhost:4173',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4173',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173',
  ];

  const origins = [
    ...defaultOrigins,
    ...(process.env.CORS_ORIGINS || '').split(','),
    ...(process.env.CORS_ORIGIN || '').split(','),
    ...(process.env.FRONTEND_URL || '').split(','),
  ]
    .map((s) => normalizeOrigin(s))
    .filter(Boolean);

  function isAllowedDevLocalhost(origin) {
    if (!origin) return false;
    return (
      /^http:\/\/localhost:\d+$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
    );
  }

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        const o = normalizeOrigin(origin);
        if (!o) return cb(null, true);
        if (origins.length === 0) return cb(null, true);
        if (origins.includes('*')) return cb(null, true);
        if (origins.includes(o)) return cb(null, true);
        if (isAllowedDevLocalhost(o)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Unauthorized'));

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub).select('-passwordHash -refreshTokenHash');
      if (!user) return next(new Error('Unauthorized'));
      if (user.status === 'blocked') return next(new Error('Forbidden'));

      socket.user = user;
      return next();
    } catch (e) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    try {
      const me = String(socket.user?._id || '').trim();
      if (me) {
        const existingTimer = offlineTimers.get(me);
        if (existingTimer) {
          clearTimeout(existingTimer);
          offlineTimers.delete(me);
        }

        const prev = Number(onlineUserCounts.get(me) || 0);
        onlineUserCounts.set(me, prev + 1);
        socket.emit('presence:state', { onlineUserIds: snapshotOnlineUserIds() });
        if (prev === 0) {
          socket.broadcast.emit('presence:update', { userId: me, online: true });
        }
      }
    } catch {
      // ignore
    }

    registerChatHandlers(io, socket);

    socket.on('disconnect', () => {
      try {
        const me = String(socket.user?._id || '').trim();
        if (!me) return;

        const prev = Number(onlineUserCounts.get(me) || 0);
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          onlineUserCounts.delete(me);

          const existingTimer = offlineTimers.get(me);
          if (existingTimer) clearTimeout(existingTimer);

          const t = setTimeout(() => {
            offlineTimers.delete(me);
            // Only mark offline if user didn't reconnect during grace window.
            const c = Number(onlineUserCounts.get(me) || 0);
            if (c === 0) {
              socket.broadcast.emit('presence:update', { userId: me, online: false });
            }
          }, OFFLINE_GRACE_MS);

          offlineTimers.set(me, t);
        } else {
          onlineUserCounts.set(me, next);
        }
      } catch {
        // ignore
      }
    });
  });
}

module.exports = { initSockets };
