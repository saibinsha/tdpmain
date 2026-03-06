const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const rootEnvPath = path.join(process.cwd(), '.env');
const srcEnvPath = path.join(__dirname, '.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(srcEnvPath)) {
  dotenv.config({ path: srcEnvPath });
} else {
  dotenv.config();
}

const http = require('http');
const mongoose = require('mongoose');

const { app } = require('./app');
const { initCloudinary } = require('./config/cloudinary');
const { initPassport } = require('./config/passport');
const { initSockets } = require('./sockets');
const { ensureSeedAdmin } = require('./utils/seedAdmin');
const { ensureSeedDemoUsers } = require('./utils/seedDemoUsers');

const PORT = process.env.PORT || 5000;

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: process.env.NODE_ENV !== 'production',
  });

  initCloudinary();
  initPassport(app);

  await ensureSeedAdmin();
  await ensureSeedDemoUsers();

  const server = http.createServer(app);
  initSockets(server);

  server.listen(PORT, () => {
    // Intentionally no console logs added beyond minimal operational signal
    console.log(`API listening on :${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
