const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    startsAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

AlertSchema.index({ isActive: 1, expiresAt: 1, startsAt: 1 });

module.exports = mongoose.model('Alert', AlertSchema);
