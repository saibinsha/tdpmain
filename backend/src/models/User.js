const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

const ROLES = ['admin', 'user'];
const STATUSES = ['active', 'blocked'];

const DigitalIdSchema = new mongoose.Schema(
  {
    aadhaarLast4: { type: String, trim: true },
    voterId: { type: String, trim: true },
    qrData: { type: String },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    membershipId: { type: String, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true, index: true },
    profilePicture: { type: String, default: '' },

    fcmToken: { type: String, trim: true, default: '' },

    district: { type: String, trim: true, index: true, default: '' },
    constituency: { type: String, trim: true, index: true, default: '' },
    address: { type: String, trim: true, default: '' },

    role: { type: String, enum: ROLES, default: 'user', index: true },
    status: { type: String, enum: STATUSES, default: 'active', index: true },

    authProvider: { type: String, enum: ['google', 'local'], default: 'google' },
    googleId: { type: String, index: true },

    passwordHash: { type: String, select: false },

    refreshTokenHash: { type: String, select: false },

    digitalId: { type: DigitalIdSchema, default: {} },
  },
  { timestamps: true, discriminatorKey: 'kind' }
);

UserSchema.pre('validate', function (next) {
  if (!this.membershipId) {
    this.membershipId = `TDP-${nanoid(10).toUpperCase()}`;
  }
  next();
});

UserSchema.methods.comparePassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.statics.createAdmin = async function ({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return this.create({
    name,
    email: String(email).toLowerCase(),
    phone: '',
    role: 'admin',
    status: 'active',
    authProvider: 'local',
    passwordHash,
  });
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
