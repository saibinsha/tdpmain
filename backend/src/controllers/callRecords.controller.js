const multer = require('multer');
const { Readable } = require('stream');

const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const CallRecord = require('../models/CallRecord');
const { getCloudinary2 } = require('../config/cloudinary2');

const recordingUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

function uploadBufferToCloudinary(cld, buffer, options) {
  return new Promise((resolve, reject) => {
    let uploader;
    if (cld && cld.uploader && cld.uploader.upload_stream) {
      uploader = cld.uploader;
    } else if (cld && cld.upload && cld.upload) {
      uploader = cld;
    }

    if (!uploader || !uploader.upload_stream) {
      return reject(new Error('Cloudinary is not configured'));
    }

    const stream = uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      return resolve(result);
    });

    Readable.from(buffer).pipe(stream);
  });
}

const uploadCallRecording = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('File required', 400);

  const cld = getCloudinary2();
  if (!cld) throw new AppError('Cloudinary2 is not configured', 500);

  const {
    callId,
    scope,
    kind,
    fromUserId,
    toUserId,
    groupId,
    startedAt,
    endedAt,
    durationSec,
    mimeType,
  } = req.body || {};

  if (!callId) throw new AppError('callId is required', 400);
  if (scope !== 'private' && scope !== 'group') throw new AppError('scope must be private or group', 400);
  if (kind !== 'audio' && kind !== 'video') throw new AppError('kind must be audio or video', 400);

  const folder = process.env.CLOUDINARY_CALL_RECORDS_FOLDER || 'tdp-call-records';

  const result = await uploadBufferToCloudinary(cld, req.file.buffer, {
    folder,
    resource_type: 'video',
  });

  const doc = await CallRecord.create({
    callId: String(callId),
    scope,
    kind,
    uploader: req.user._id,
    fromUser: fromUserId || undefined,
    toUser: toUserId || undefined,
    groupId: groupId || undefined,
    startedAt: startedAt ? new Date(startedAt) : undefined,
    endedAt: endedAt ? new Date(endedAt) : undefined,
    durationSec: durationSec !== undefined && durationSec !== null ? Number(durationSec) : undefined,
    mimeType: mimeType ? String(mimeType) : String(req.file.mimetype || ''),
    file: {
      url: result.secure_url || result.url,
      publicId: result.public_id,
      bytes: result.bytes || 0,
      format: result.format || '',
      resourceType: result.resource_type || 'video',
    },
  });

  res.status(201).json({ ok: true, record: doc });
});

const listCallRecordsAdmin = asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

  const items = await CallRecord.find({})
    .populate('uploader', 'name membershipId profilePicture role')
    .populate('fromUser', 'name membershipId profilePicture role')
    .populate('toUser', 'name membershipId profilePicture role')
    .sort({ createdAt: -1 })
    .limit(limit);

  res.json({ ok: true, items });
});

module.exports = {
  recordingUploader,
  uploadCallRecording,
  listCallRecordsAdmin,
};
