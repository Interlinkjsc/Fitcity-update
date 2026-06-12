require('dotenv').config({ path: '.env' });

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Fitcity_Test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test_session_secret_32_chars_minimum';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef';
process.env.QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || 'test_qr_hmac_secret_for_jest_ci';
