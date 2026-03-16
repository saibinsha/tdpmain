const mongoose = require('mongoose');

const GroupMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const GroupJoinRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const GroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '', trim: true },
    isPublic: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    media: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      resourceType: { type: String, default: '' },
    },
    members: { type: [GroupMemberSchema], default: [] },
    joinRequests: { type: [GroupJoinRequestSchema], default: [] },
    blockedUsers: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [], index: true },
  },
  { timestamps: true }
);

GroupSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Group', GroupSchema);
