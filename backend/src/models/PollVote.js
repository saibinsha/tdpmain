const mongoose = require('mongoose');

const PollVoteSchema = new mongoose.Schema(
  {
    poll: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    optionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

PollVoteSchema.index({ poll: 1, user: 1 }, { unique: true });
PollVoteSchema.index({ poll: 1, optionId: 1 });

module.exports = mongoose.model('PollVote', PollVoteSchema);
