const express = require('express');

const { adminLogin, adminRefresh } = require('../controllers/adminAuth.controller');

const router = express.Router();

router.post('/login', adminLogin);
router.post('/refresh', adminRefresh);

module.exports = router;
