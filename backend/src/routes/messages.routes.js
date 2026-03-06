const express = require('express');

const { requireAuth } = require('../middlewares/auth');
const {
  listCommunityMessages,
  listGroupMessages,
  listPrivateMessages,
  listConversations,
  deletePrivateMessage,
  deleteGroupMessage,
  deleteCommunityMessage,
} = require('../controllers/messages.controller');

const router = express.Router();

router.get('/community', requireAuth, listCommunityMessages);
router.delete('/community/:id', requireAuth, deleteCommunityMessage);
router.get('/groups/:groupId', requireAuth, listGroupMessages);
router.delete('/groups/message/:id', requireAuth, deleteGroupMessage);
router.get('/private/:otherUserId', requireAuth, listPrivateMessages);
router.delete('/private/:id', requireAuth, deletePrivateMessage);
router.get('/conversations', requireAuth, listConversations);

module.exports = router;
