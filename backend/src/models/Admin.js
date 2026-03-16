const mongoose = require('mongoose');
const User = require('./User');

const Admin = User.discriminator(
  'Admin',
  new mongoose.Schema(
    {
      permissions: { type: [String], default: [] },
    },
    { timestamps: true }
  )
);

module.exports = Admin;
