/**
 * Seed một tài khoản Admin (mặc định SA).
 * Chạy: npm run seed:admin
 *
 * Tuỳ chọn (.env):
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_ROLE (SA | Admin)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../modules/users/models/userModel.js');
const { hash } = require('../utils/encryption');

const ADMIN = {
    name: process.env.ADMIN_NAME || 'System Admin',
    email: process.env.ADMIN_EMAIL || 'admin@fitcity.com',
    password: process.env.ADMIN_PASSWORD || '123456',
    role: process.env.ADMIN_ROLE || 'SA',
    status: 'Active'
};

async function seedAdmin() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity';
    await mongoose.connect(uri);
    console.log('Connected:', uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@'));

    const emailHash = hash(ADMIN.email);
    let user = await User.findOne({ emailHash }).select('+password');

    if (user) {
        user.name = ADMIN.name;
        user.role = ADMIN.role;
        user.status = ADMIN.status;
        user.password = ADMIN.password;
        await user.save();
        console.log('Updated existing admin account.');
    } else {
        user = await User.create({
            name: ADMIN.name,
            email: ADMIN.email,
            password: ADMIN.password,
            role: ADMIN.role,
            status: ADMIN.status
        });
        console.log('Created new admin account.');
    }

    console.log('\n--- Admin login ---');
    console.log('Email:   ', ADMIN.email);
    console.log('Password:', ADMIN.password);
    console.log('Role:    ', ADMIN.role);
    console.log('Login:   http://localhost:4000/auth/login\n');

    await mongoose.disconnect();
    process.exit(0);
}

seedAdmin().catch((err) => {
    console.error('seed:admin failed:', err.message);
    process.exit(1);
});
