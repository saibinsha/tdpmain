const mongoose = require('mongoose');

const SurveySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

SurveySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Survey', SurveySchema);
