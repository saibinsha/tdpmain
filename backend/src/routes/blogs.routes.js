const express = require('express');

const { requireAuth, tryAuth } = require('../middlewares/auth');
const {
  createBlog,
  listBlogs,
  getBlog,
  updateBlog,
  deleteBlog,
  likeBlog,
  unlikeBlog,
  commentBlog,
} = require('../controllers/blogs.controller');

const router = express.Router();

router.get('/', listBlogs);
router.get('/:idOrSlug', tryAuth, getBlog);

router.post('/', requireAuth, createBlog);
router.patch('/:id', requireAuth, updateBlog);
router.delete('/:id', requireAuth, deleteBlog);

router.post('/:id/like', requireAuth, likeBlog);
router.delete('/:id/like', requireAuth, unlikeBlog);
router.post('/:id/comments', requireAuth, commentBlog);

module.exports = router;
