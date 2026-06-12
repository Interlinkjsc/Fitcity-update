const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  console.log('🚀 Starting local MongoDB in-memory...');
  const mongod = await MongoMemoryServer.create({ instance: { port: 27888 } });
  const uri = mongod.getUri();
  console.log('✅ MongoDB ready at:', uri);

  // Override env
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'development';
  process.env.PORT = '3001';
  process.env.SESSION_SECRET = 'local-test-secret';
  process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
  process.env.QR_HMAC_SECRET = 'local-qr-secret';

  // Start app
  const http = require('http');
  const app = require('./src/app');
  const connectDB = require('./src/config/db');
  const socketService = require('./src/modules/platform/services/socketService');

  const server = http.createServer(app);
  socketService.init(server);
  await connectDB();

  // Seed admin user
  await seedAdmin();

  server.listen(3001, () => {
    console.log('');
    console.log('========================================');
    console.log('✅ FitCity LOCAL đang chạy tại:');
    console.log('   http://localhost:3001');
    console.log('');
    console.log('🔐 Login: admin@fitcity.com / 123456');
    console.log('========================================');
  });

  process.on('SIGTERM', async () => { await mongod.stop(); process.exit(0); });
}

async function seedAdmin() {
  try {
    const { execSync } = require('child_process');
    const User = require('./src/modules/users/models/userModel');
    const bcrypt = require('bcryptjs');
    const { hash } = require('./src/utils/encryption');

    const exists = await User.findOne({ emailHash: hash('admin@fitcity.com') });
    if (!exists) {
      const hashedPw = await bcrypt.hash('123456', 12);
      await User.create({
        name: 'Super Admin',
        email: 'admin@fitcity.com',
        password: hashedPw,
        role: 'SA',
        status: 'Active'
      });
      console.log('✅ Admin seeded: admin@fitcity.com / 123456');
    } else {
      console.log('✅ Admin đã tồn tại');
    }
  } catch (e) {
    console.error('Seed admin error:', e.message);
  }
}

main().catch(console.error);
