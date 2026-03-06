const express = require('express');

const { requireAuth, requireRole } = require('../middlewares/auth');
const { createReport, listReports, handleReport } = require('../controllers/reports.controller');

const router = express.Router();

router.post('/', requireAuth, createReport);

router.get('/', requireAuth, requireRole('admin'), listReports);
router.patch('/:id/handle', requireAuth, requireRole('admin'), handleReport);

module.exports = router;
