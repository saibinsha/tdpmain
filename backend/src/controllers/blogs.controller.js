const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { slugify } = require('../utils/slugify');

const Blog = require('../models/Blog');
const BlogLike = require('../models/BlogLike');
const BlogComment = require('../models/BlogComment');

const createBlog = asyncHandler(async (req, res) => {
  const { title, content, tags, media } = req.body;
  if (!title || !content) throw new AppError('title and content are required', 400);

  const baseSlug = slugify(title);
  let slug = baseSlug;
  let counter = 1;
  while (await Blog.exists({ slug })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const doc = await Blog.create({
    title,
    slug,
    content,
    tags: Array.isArray(tags) ? tags : [],
    media: Array.isArray(media) ? media : [],
    createdBy: req.user._id,
  });

  res.status(201).json({ ok: true, blog: doc });
});

const listBlogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, q, tag } = req.query;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

  const filter = {};
  if (tag) filter.tags = String(tag);
  if (q) filter.$text = { $search: String(q) };

  const [items, total] = await Promise.all([
    Blog.find(filter)
      .populate('createdBy', 'name membershipId profilePicture')
      .sort(q ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l),
    Blog.countDocuments(filter),
  ]);

  res.json({ ok: true, page: p, limit: l, total, items });
});

const getBlog = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const blog = await Blog.findOne({ $or: [{ _id: idOrSlug }, { slug: idOrSlug }] }).populate(
    'createdBy',
    'name membershipId profilePicture'
  );
  if (!blog) throw new AppError('Blog not found', 404);

  const [likes, comments, likedByMe] = await Promise.all([
    BlogLike.countDocuments({ blog: blog._id }),
    BlogComment.find({ blog: blog._id, isDeleted: false })
      .populate('user', 'name membershipId profilePicture')
      .sort({ createdAt: -1 })
      .limit(50),
    req.user ? BlogLike.exists({ blog: blog._id, user: req.user._id }).then(Boolean) : Promise.resolve(false),
  ]);

  res.json({ ok: true, blog, meta: { likes, comments, likedByMe } });
});

const updateBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const blog = await Blog.findById(id);
  if (!blog) throw new AppError('Blog not found', 404);

  const isOwner = String(blog.createdBy) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') throw new AppError('Forbidden', 403);

  const allowed = ['title', 'content', 'tags', 'media'];
  for (const k of allowed) {
    if (req.body[k] !== undefined) blog[k] = req.body[k];
  }

  if (req.body.title) {
    const baseSlug = slugify(req.body.title);
    let slug = baseSlug;
    let counter = 1;
    while (await Blog.exists({ slug, _id: { $ne: blog._id } })) {
      slug = `${baseSlug}-${counter++}`;
    }
    blog.slug = slug;
  }

  await blog.save();
  res.json({ ok: true, blog });
});

const deleteBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const blog = await Blog.findById(id);
  if (!blog) throw new AppError('Blog not found', 404);

  const isOwner = String(blog.createdBy) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') throw new AppError('Forbidden', 403);

  await Promise.all([
    BlogLike.deleteMany({ blog: blog._id }),
    BlogComment.deleteMany({ blog: blog._id }),
    Blog.deleteOne({ _id: blog._id }),
  ]);

  res.json({ ok: true });
});

const likeBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const blog = await Blog.findById(id);
  if (!blog) throw new AppError('Blog not found', 404);

  await BlogLike.updateOne(
    { blog: blog._id, user: req.user._id },
    { $setOnInsert: { blog: blog._id, user: req.user._id } },
    { upsert: true }
  );

  const likes = await BlogLike.countDocuments({ blog: blog._id });
  res.json({ ok: true, likes });
});

const unlikeBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await BlogLike.deleteOne({ blog: id, user: req.user._id });
  const likes = await BlogLike.countDocuments({ blog: id });
  res.json({ ok: true, likes });
});

const commentBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text) throw new AppError('text is required', 400);

  const blog = await Blog.findById(id);
  if (!blog) throw new AppError('Blog not found', 404);

  const doc = await BlogComment.create({ blog: blog._id, user: req.user._id, text });
  const populated = await doc.populate('user', 'name membershipId profilePicture');

  res.status(201).json({ ok: true, comment: populated });
});

module.exports = {
  createBlog,
  listBlogs,
  getBlog,
  updateBlog,
  deleteBlog,
  likeBlog,
  unlikeBlog,
  commentBlog,
};
