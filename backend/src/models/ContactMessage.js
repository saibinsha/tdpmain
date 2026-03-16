const mongoose = require('mongoose');

const ContactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, default: '', trim: true },
    category: { type: String, default: 'General', trim: true, index: true },
    subject: { type: String, default: '', trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ['new', 'in_progress', 'closed'], default: 'new', index: true },
  },
  { timestamps: true }
);

ContactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
