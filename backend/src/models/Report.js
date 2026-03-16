const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: ['user', 'blog', 'group', 'other'], required: true, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true, default: null },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['open', 'resolved', 'ignored'], default: 'open', index: true },
    adminNote: { type: String, default: '', trim: true },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

ReportSchema.index({ targetType: 1, targetId: 1, status: 1 });

module.exports = mongoose.model('Report', ReportSchema);
