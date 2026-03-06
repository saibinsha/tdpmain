const mongoose = require('mongoose');

const CallRecordSchema = new mongoose.Schema(
  {
    callId: { type: String, required: true, index: true },
    scope: { type: String, enum: ['private', 'group'], required: true, index: true },
    kind: { type: String, enum: ['audio', 'video'], required: true },

    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true },

    startedAt: { type: Date },
    endedAt: { type: Date },
    durationSec: { type: Number },

    file: {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      bytes: { type: Number, default: 0 },
      format: { type: String, default: '' },
      resourceType: { type: String, default: '' },
    },

    mimeType: { type: String, default: '' },
  },
  { timestamps: true }
);

CallRecordSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CallRecord', CallRecordSchema);
