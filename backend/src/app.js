const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { notFoundHandler } = require('./middlewares/notFound');
const { errorHandler } = require('./middlewares/errorHandler');

const authRoutes = require('./routes/auth.routes');
const adminAuthRoutes = require('./routes/adminAuth.routes');
const userRoutes = require('./routes/users.routes');
const blogRoutes = require('./routes/blogs.routes');
const pollRoutes = require('./routes/polls.routes');
const surveyRoutes = require('./routes/surveys.routes');
const workRoutes = require('./routes/works.routes');
const groupRoutes = require('./routes/groups.routes');
const alertRoutes = require('./routes/alerts.routes');
const contactRoutes = require('./routes/contact.routes');
const reportRoutes = require('./routes/reports.routes');
const uploadRoutes = require('./routes/uploads.routes');
const messageRoutes = require('./routes/messages.routes');
const callRecordsRoutes = require('./routes/callRecords.routes');
const newsRoutes = require('./routes/news.routes');
const newsletterRoutes = require('./routes/newsletter.routes');
const adminChatsRoutes = require('./routes/adminChats.routes');
const adminBlogCommentsRoutes = require('./routes/adminBlogComments.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();

app.set('trust proxy', 1);

function normalizeOrigin(o) {
  return String(o || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\/+$/, '');
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

const corsOptions = {
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
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/works', workRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/call-records', callRecordsRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api', notificationsRoutes);
app.use('/api/admin/chats', adminChatsRoutes);
app.use('/api/admin/blog-comments', adminBlogCommentsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
