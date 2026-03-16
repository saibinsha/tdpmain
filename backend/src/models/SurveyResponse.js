const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'SurveyQuestion', required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const SurveyResponseSchema = new mongoose.Schema(
  {
    survey: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: { type: [AnswerSchema], default: [] },
  },
  { timestamps: true }
);

SurveyResponseSchema.index({ survey: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('SurveyResponse', SurveyResponseSchema);
