const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function ensureSeedDemoUsers() {
  if (process.env.NODE_ENV === 'production') return;

  const enabled = String(process.env.SEED_DEMO_USERS || 'true').toLowerCase() === 'true';
  if (!enabled) return;

  const demoAdminEmail = String(process.env.DEMO_ADMIN_EMAIL || 'demo.admin@tdp.local').toLowerCase();
  const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD || 'DemoAdmin123!';
  const demoAdminName = process.env.DEMO_ADMIN_NAME || 'Demo Admin';

  const demoUserEmail = String(process.env.DEMO_USER_EMAIL || 'demo.user@tdp.local').toLowerCase();
  const demoUserPassword = process.env.DEMO_USER_PASSWORD || 'DemoUser123!';
  const demoUserName = process.env.DEMO_USER_NAME || 'Demo User';

  const adminExists = await User.findOne({ email: demoAdminEmail });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash(demoAdminPassword, 12);
    await User.create({
      name: demoAdminName,
      email: demoAdminEmail,
      phone: '9999999999',
      role: 'admin',
      status: 'active',
      authProvider: 'local',
      passwordHash,
    });
  }

  const userExists = await User.findOne({ email: demoUserEmail });
  if (!userExists) {
    const passwordHash = await bcrypt.hash(demoUserPassword, 12);
    await User.create({
      name: demoUserName,
      email: demoUserEmail,
      phone: '8888888888',
      role: 'user',
      status: 'active',
      authProvider: 'local',
      passwordHash,
    });
  }
}

module.exports = { ensureSeedDemoUsers };
