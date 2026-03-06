const express = require('express');

const { googleStart, googleCallback, loginLocal, refresh, logout } = require('../controllers/auth.controller');

const router = express.Router();

router.get('/google', googleStart);
router.get('/google/callback', googleCallback);

router.post('/login', loginLocal);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
