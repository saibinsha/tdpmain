const express = require('express');

const { requireAuth, requireRole } = require('../middlewares/auth');
const { subscribe, listSubscribers } = require('../controllers/newsletter.controller');

const router = express.Router();

router.post('/', subscribe);
router.get('/', requireAuth, requireRole('admin'), listSubscribers);

module.exports = router;
