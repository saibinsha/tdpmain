const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');

const BlogComment = require('../models/BlogComment');

const listBlogCommentsAdmin = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, q } = req.query;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  const filter = { isDeleted: false };
  if (q) {
    filter.text = { $regex: String(q), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    BlogComment.find(filter)
      .populate('user', 'name membershipId profilePicture role')
      .populate({ path: 'blog', select: 'title slug createdBy', populate: { path: 'createdBy', select: 'name membershipId profilePicture' } })
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l),
    BlogComment.countDocuments(filter),
  ]);

  res.json({ ok: true, page: p, limit: l, total, items });
});

const deleteBlogCommentAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await BlogComment.findById(id);
  if (!doc) throw new AppError('Comment not found', 404);
  doc.isDeleted = true;
  await doc.save();
  res.json({ ok: true });
});

module.exports = { listBlogCommentsAdmin, deleteBlogCommentAdmin };
