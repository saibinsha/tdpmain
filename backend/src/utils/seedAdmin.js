const User = require('../models/User');

async function ensureSeedAdmin() {
  const seeds = [
    {
      name: process.env.SEED_ADMIN_NAME || 'Admin',
      email: (process.env.SEED_ADMIN_EMAIL || '').toLowerCase(),
      password: process.env.SEED_ADMIN_PASSWORD || '',
    },
    {
      name: process.env.SEED_ADMIN_NAME_2 || 'Admin',
      email: (process.env.SEED_ADMIN_EMAIL_2 || '').toLowerCase(),
      password: process.env.SEED_ADMIN_PASSWORD_2 || '',
    },
  ].filter((s) => s.email && s.password);

  for (const s of seeds) {
    const existing = await User.findOne({ email: s.email });
    if (existing) continue;
    await User.createAdmin({ name: s.name, email: s.email, password: s.password });
  }
}

module.exports = { ensureSeedAdmin };
