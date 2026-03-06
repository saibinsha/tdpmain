const mongoose = require('mongoose');

const WorkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: 'General', index: true },
    location: { type: String, trim: true, default: '', index: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium', index: true },

    status: { type: String, enum: ['Open', 'In Progress', 'Found', 'Completed'], default: 'Open', index: true },
    foundAt: { type: Date, default: null },
  },
  { timestamps: true }
);

WorkSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Work', WorkSchema);
