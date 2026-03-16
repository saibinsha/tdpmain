const express = require('express');

const { requireAuth, requireRole } = require('../middlewares/auth');
const { createPoll, listPolls, votePoll, getResults, deletePoll } = require('../controllers/polls.controller');

const router = express.Router();

router.get('/', listPolls);
router.get('/:id/results', getResults);
router.post('/:id/vote', requireAuth, votePoll);

router.post('/', requireAuth, requireRole('admin'), createPoll);
router.delete('/:id', requireAuth, requireRole('admin'), deletePoll);

module.exports = router;
