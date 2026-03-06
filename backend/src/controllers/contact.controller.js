const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const ContactMessage = require('../models/ContactMessage');

const submitContact = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message, category } = req.body;
  if (!name || !email || !message) throw new AppError('name, email and message are required', 400);

  const doc = await ContactMessage.create({
    name,
    email: String(email).toLowerCase(),
    phone: phone || '',
    category: category || 'General',
    subject: subject || '',
    message,
  });

  res.status(201).json({ ok: true, contact: doc });
});

const listContacts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, category } = req.query;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;

  const [items, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
    ContactMessage.countDocuments(filter),
  ]);

  res.json({ ok: true, page: p, limit: l, total, items });
});

const updateContactStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['new', 'in_progress', 'closed'].includes(status)) throw new AppError('Invalid status', 400);

  const doc = await ContactMessage.findByIdAndUpdate(id, { status }, { new: true });
  if (!doc) throw new AppError('Contact message not found', 404);

  res.json({ ok: true, contact: doc });
});

const deleteContact = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await ContactMessage.findById(id);
  if (!doc) throw new AppError('Contact message not found', 404);
  await ContactMessage.deleteOne({ _id: doc._id });
  res.json({ ok: true });
});

module.exports = { submitContact, listContacts, updateContactStatus, deleteContact };
