const express = require('express');

const { listLeadersNews } = require('../controllers/news.controller');

const router = express.Router();

router.get('/leaders', listLeadersNews);

module.exports = router;
