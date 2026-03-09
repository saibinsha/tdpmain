const express = require('express');

const { googleStart, googleCallback, googleNative, registerLocal, loginLocal, refresh, logout } = require('../controllers/auth.controller');

const router = express.Router();

router.get('/google', googleStart);
router.get('/google/callback', googleCallback);

router.post('/google/native', googleNative);

router.post('/register', registerLocal);
router.post('/login', loginLocal);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
