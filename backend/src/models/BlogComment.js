const mongoose = require('mongoose');

const BlogCommentSchema = new mongoose.Schema(
  {
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, required: true, trim: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

BlogCommentSchema.index({ blog: 1, createdAt: -1 });

module.exports = mongoose.model('BlogComment', BlogCommentSchema);
