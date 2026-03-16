const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    resourceType: { type: String, enum: ['image', 'video', 'raw', 'auto'], default: 'image' },
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['private', 'group'], required: true, index: true },

    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true },

    text: { type: String, default: '' },
    media: { type: MediaSchema, default: null },

    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true }
);

MessageSchema.index({ type: 1, from: 1, to: 1, createdAt: -1 });
MessageSchema.index({ type: 1, group: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
