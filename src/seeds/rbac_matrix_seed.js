const mongoose = require('mongoose');
const User = require('../modules/users/models/userModel.js');
const Branch = require('../modules/crm/models/branchModel.js');
const { hash } = require('../utils/encryption');
require('dotenv').config();

const seedRBAC = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_fitness');
        console.log('🌱 Starting RBAC Matrix Seeding...');

        // 1. Tạo Chi nhánh mẫu
        let branch = await Branch.findOne({ name: 'FitCity HQ' });
        if (!branch) {
            branch = await Branch.create({
                name: 'FitCity HQ',
                address: '123 Fit Street, HCM',
                phone: '0901234567'
            });
        }

        const commonPassword = 'Password123!';

        const users = [
            { name: 'System Admin', role: 'Admin', email: 'admin@fitcity.com' },
            { name: 'The CEO', role: 'CEO', email: 'ceo@fitcity.com' },
            { name: 'Chief Accountant', role: 'Accountant', email: 'accountant@fitcity.com' },
            { name: 'D1 Branch Manager', role: 'Manager', email: 'manager@fitcity.com', branch: branch._id },
            { name: 'Marketing Lead', role: 'Marketing', email: 'marketing@fitcity.com' },
            { name: 'Master PT', role: 'PT', email: 'pt@fitcity.com', branch: branch._id },
            { name: 'VIP Client', role: 'Client', email: 'client@fitcity.com', branch: branch._id }
        ];

        for (const u of users) {
            const emailH = hash(u.email);
            const existing = await User.findOne({ emailHash: emailH });
            
            if (!existing) {
                await User.create({
                    ...u,
                    emailHash: emailH,
                    password: commonPassword,
                    status: 'Active'
                });
                console.log(`✅ Created ${u.role}: ${u.email}`);
            } else {
                console.log(`ℹ️ User ${u.role} already exists.`);
            }
        }

        console.log('✨ Seeding Completed! (Password for all: Password123!)');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding Failed:', err);
        process.exit(1);
    }
};

seedRBAC();
