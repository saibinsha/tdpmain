const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const Alert = require('../models/Alert');

const createAlert = asyncHandler(async (req, res) => {
  const { title, message, startsAt, expiresAt, isActive } = req.body;
  if (!title || !message) throw new AppError('title and message are required', 400);

  const doc = await Alert.create({
    title,
    message,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    startsAt: startsAt ? new Date(startsAt) : new Date(),
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdBy: req.user._id,
  });

  res.status(201).json({ ok: true, alert: doc });
});

const listActiveAlerts = asyncHandler(async (req, res) => {
  const now = new Date();
  const items = await Alert.find({
    isActive: true,
    startsAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ ok: true, items });
});

const listAlertsAdmin = asyncHandler(async (req, res) => {
  const items = await Alert.find({}).sort({ createdAt: -1 }).limit(200);
  res.json({ ok: true, items });
});

const deleteAlert = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await Alert.findByIdAndDelete(id);
  if (!doc) throw new AppError('Alert not found', 404);
  res.json({ ok: true });
});

module.exports = { createAlert, listActiveAlerts, listAlertsAdmin, deleteAlert };
