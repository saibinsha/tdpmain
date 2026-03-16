const crypto = require('crypto');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');

function normalizeResourceType(input, mimetype) {
  const rt = String(input || '').toLowerCase();
  if (rt === 'image' || rt === 'video' || rt === 'raw') return rt;
  const mt = String(mimetype || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  return 'raw';
}

const uploadSingle = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('File required', 400);

  const f = req.file;
  const normalizedResourceType = normalizeResourceType(f.resource_type || f.resourceType, f.mimetype);

  res.status(201).json({
    ok: true,
    file: {
      url: f.path,
      publicId: f.filename,
      resourceType: normalizedResourceType,
      bytes: f.size,
      originalname: f.originalname,
    },
  });
});

const getDirectUploadSignature = asyncHandler(async (req, res) => {
  const { folder, publicId, resourceType } = req.body || {};

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError('Cloudinary is not configured', 500);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const usedFolder = folder || process.env.CLOUDINARY_FOLDER || 'tdp-party';

  const paramsToSign = {
    folder: usedFolder,
    timestamp,
  };

  if (publicId) paramsToSign.public_id = publicId;
  if (resourceType) paramsToSign.resource_type = resourceType;

  const sorted = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k]}`)
    .join('&');

  const signature = crypto.createHash('sha1').update(sorted + apiSecret).digest('hex');

  res.json({
    ok: true,
    cloudName,
    apiKey,
    timestamp,
    folder: usedFolder,
    signature,
  });
});

module.exports = { uploadSingle, getDirectUploadSignature };
