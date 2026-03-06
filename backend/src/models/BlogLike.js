const mongoose = require('mongoose');

const BlogLikeSchema = new mongoose.Schema(
  {
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

BlogLikeSchema.index({ blog: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('BlogLike', BlogLikeSchema);
