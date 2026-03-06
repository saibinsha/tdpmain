const express = require('express');

const { requireAuth, requireRole } = require('../middlewares/auth');
const { submitContact, listContacts, updateContactStatus, deleteContact } = require('../controllers/contact.controller');

const router = express.Router();

router.post('/', submitContact);

router.get('/', requireAuth, requireRole('admin'), listContacts);
router.patch('/:id/status', requireAuth, requireRole('admin'), updateContactStatus);
router.delete('/:id', requireAuth, requireRole('admin'), deleteContact);

module.exports = router;
