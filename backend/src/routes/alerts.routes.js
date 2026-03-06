const express = require('express');

const { requireAuth, requireRole } = require('../middlewares/auth');
const { createAlert, listActiveAlerts, listAlertsAdmin, deleteAlert } = require('../controllers/alerts.controller');

const router = express.Router();

router.get('/active', listActiveAlerts);

router.get('/', requireAuth, requireRole('admin'), listAlertsAdmin);
router.post('/', requireAuth, requireRole('admin'), createAlert);
router.delete('/:id', requireAuth, requireRole('admin'), deleteAlert);

module.exports = router;
