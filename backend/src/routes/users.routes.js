const express = require('express');

const { requireAuth, requireRole } = require('../middlewares/auth');
const {
  getMe,
  updateMe,
  directory,
  adminCreateUser,
  adminDeleteUser,
  adminSetStatus,
  listUsers,
  getUserById,
} = require('../controllers/users.controller');

const router = express.Router();

router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateMe);

router.get('/directory', requireAuth, directory);

router.get('/', requireAuth, requireRole('admin'), listUsers);
router.get('/:id', requireAuth, requireRole('admin'), getUserById);
router.post('/', requireAuth, requireRole('admin'), adminCreateUser);
router.delete('/:id', requireAuth, requireRole('admin'), adminDeleteUser);
router.patch('/:id/status', requireAuth, requireRole('admin'), adminSetStatus);

module.exports = router;
