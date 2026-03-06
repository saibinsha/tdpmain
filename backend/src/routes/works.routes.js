const express = require('express');

const { requireAuth } = require('../middlewares/auth');
const { createWork, listWorks, updateWork, deleteWork } = require('../controllers/works.controller');

const router = express.Router();

router.get('/', listWorks);
router.post('/', requireAuth, createWork);
router.patch('/:id', requireAuth, updateWork);
router.delete('/:id', requireAuth, deleteWork);

module.exports = router;
