const express = require('express');

const { requireAuth, requireRole } = require('../middlewares/auth');
const {
  listUserPrivateConversations,
  listPrivateConversationMessages,
} = require('../controllers/adminChats.controller');

const router = express.Router();

router.get('/private/conversations', requireAuth, requireRole('admin'), listUserPrivateConversations);
router.get('/private/:userId/:otherUserId', requireAuth, requireRole('admin'), listPrivateConversationMessages);

module.exports = router;
