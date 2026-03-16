const express = require('express');

const { requireAuth, requireRole } = require('../middlewares/auth');
const {
  createSurvey,
  listSurveys,
  getSurvey,
  submitResponse,
  analytics,
  deleteSurvey,
} = require('../controllers/surveys.controller');

const router = express.Router();

router.get('/', listSurveys);
router.get('/:id', getSurvey);
router.post('/:id/responses', requireAuth, submitResponse);

router.get('/:id/analytics', requireAuth, requireRole('admin'), analytics);
router.post('/', requireAuth, requireRole('admin'), createSurvey);
router.delete('/:id', requireAuth, requireRole('admin'), deleteSurvey);

module.exports = router;
