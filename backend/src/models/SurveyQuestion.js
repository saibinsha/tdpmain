const mongoose = require('mongoose');

const SurveyQuestionSchema = new mongoose.Schema(
  {
    survey: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true, index: true },
    type: { type: String, enum: ['mcq', 'text'], required: true, index: true },
    prompt: { type: String, required: true, trim: true },
    options: { type: [String], default: [] },
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

SurveyQuestionSchema.index({ survey: 1, order: 1 });

module.exports = mongoose.model('SurveyQuestion', SurveyQuestionSchema);
