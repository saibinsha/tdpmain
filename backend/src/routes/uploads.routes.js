const express = require('express');

const { requireAuth } = require('../middlewares/auth');
const { makeUploader } = require('../config/multer');
const { uploadSingle, getDirectUploadSignature } = require('../controllers/uploads.controller');

const router = express.Router();

const uploader = makeUploader({ folder: process.env.CLOUDINARY_FOLDER || 'tdp-party', resourceType: 'auto' });

router.post('/single', requireAuth, uploader.single('file'), uploadSingle);
router.post('/signature', requireAuth, getDirectUploadSignature);

module.exports = router;
