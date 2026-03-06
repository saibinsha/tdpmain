const express = require('express');

const { requireAuth, requireRole } = require('../middlewares/auth');
const {
  listBlogCommentsAdmin,
  deleteBlogCommentAdmin,
} = require('../controllers/adminBlogComments.controller');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), listBlogCommentsAdmin);
router.delete('/:id', requireAuth, requireRole('admin'), deleteBlogCommentAdmin);

module.exports = router;
