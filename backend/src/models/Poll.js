const mongoose = require('mongoose');

const PollOptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const PollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    options: { type: [PollOptionSchema], required: true, validate: (v) => Array.isArray(v) && v.length >= 2 },
    isActive: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

PollSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Poll', PollSchema);
