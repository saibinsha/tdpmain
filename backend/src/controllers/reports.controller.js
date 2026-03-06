const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');

const Report = require('../models/Report');
const User = require('../models/User');
const Blog = require('../models/Blog');
const Group = require('../models/Group');

const createReport = asyncHandler(async (req, res) => {
  const { targetType, targetId, reason } = req.body;
  if (!targetType || !reason) throw new AppError('targetType and reason are required', 400);

  if (targetType === 'user') {
    if (!targetId) throw new AppError('targetId is required', 400);
    const u = await User.findById(targetId);
    if (!u) throw new AppError('Target user not found', 404);
  } else if (targetType === 'blog') {
    if (!targetId) throw new AppError('targetId is required', 400);
    const b = await Blog.findById(targetId);
    if (!b) throw new AppError('Target blog not found', 404);
  } else if (targetType === 'group') {
    if (!targetId) throw new AppError('targetId is required', 400);
    const g = await Group.findById(targetId);
    if (!g) throw new AppError('Target group not found', 404);
  } else if (targetType === 'other') {
    // free-form report
  } else {
    throw new AppError('Invalid targetType', 400);
  }

  const doc = await Report.create({
    reporter: req.user._id,
    targetType,
    targetId: targetId || null,
    reason,
    status: 'open',
  });

  res.status(201).json({ ok: true, report: doc });
});

const listReports = asyncHandler(async (req, res) => {
  const { status, targetType, page = 1, limit = 20 } = req.query;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const filter = {};
  if (status) filter.status = status;
  if (targetType) filter.targetType = targetType;

  const [items, total] = await Promise.all([
    Report.find(filter)
      .populate('reporter', 'name membershipId email')
      .populate('handledBy', 'name membershipId email')
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l),
    Report.countDocuments(filter),
  ]);

  res.json({ ok: true, page: p, limit: l, total, items });
});

const handleReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, adminNote } = req.body;

  if (!['resolve', 'ignore', 'block_user'].includes(action)) throw new AppError('Invalid action', 400);

  const report = await Report.findById(id);
  if (!report) throw new AppError('Report not found', 404);

  if (action === 'block_user') {
    if (report.targetType !== 'user') throw new AppError('block_user only applies to user reports', 400);
    await User.findByIdAndUpdate(report.targetId, { status: 'blocked' });
    report.status = 'resolved';
  } else if (action === 'resolve') {
    report.status = 'resolved';
  } else {
    report.status = 'ignored';
  }

  report.adminNote = adminNote || '';
  report.handledBy = req.user._id;
  await report.save();

  res.json({ ok: true, report });
});

module.exports = { createReport, listReports, handleReport };
