const express = require('express');

const { requireAuth } = require('../middlewares/auth');
const { saveToken } = require('../controllers/notifications.controller');

const router = express.Router();

router.post('/save-token', requireAuth, saveToken);

module.exports = router;
