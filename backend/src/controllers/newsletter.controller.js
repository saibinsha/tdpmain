const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');

const NewsletterSubscriber = require('../models/NewsletterSubscriber');

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

const subscribe = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) throw new AppError('email is required', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Invalid email', 400);

  const source = req.body?.source ? String(req.body.source).trim() : 'footer';

  const existing = await NewsletterSubscriber.findOne({ email }).lean();
  if (existing) {
    return res.json({ ok: true, subscriber: existing, alreadySubscribed: true });
  }

  const doc = await NewsletterSubscriber.create({ email, source });
  res.status(201).json({ ok: true, subscriber: doc, alreadySubscribed: false });
});

const listSubscribers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, q } = req.query;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  const filter = {};
  if (q) {
    filter.email = { $regex: String(q), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    NewsletterSubscriber.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
    NewsletterSubscriber.countDocuments(filter),
  ]);

  res.json({ ok: true, page: p, limit: l, total, items });
});

module.exports = { subscribe, listSubscribers };
