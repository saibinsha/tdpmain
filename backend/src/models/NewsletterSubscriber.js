const mongoose = require('mongoose');

const NewsletterSubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    source: { type: String, default: 'footer', trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NewsletterSubscriber', NewsletterSubscriberSchema);
