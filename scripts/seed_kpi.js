require('dotenv').config();
const mongoose = require('mongoose');
const Branch = require('../src/modules/crm/models/branchModel.js');
const KPIConfig = require('../src/modules/programs/models/kpiModel.js');

// Ensure db URI is correctly set
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity';

async function seedKPI() {
    try {
        await mongoose.connect(DB_URI);
        console.log('Connected to MongoDB.');

        const branches = await Branch.find();
        if (branches.length === 0) {
            console.log('No branches found. Please seed branches first.');
            return;
        }

        const month = 5;
        const year = 2026;

        for (const branch of branches) {
            // Setup random realistic targets based on branch size or standard
            // E.g., Revenue Target: 50M to 200M VND
            const revenueTarget = Math.floor(Math.random() * (200000000 - 50000000 + 1)) + 50000000;
            const newLeadTarget = Math.floor(Math.random() * 50) + 10;
            const contractTarget = Math.floor(Math.random() * 20) + 5;

            await KPIConfig.findOneAndUpdate(
                { branch: branch._id, month, year },
                {
                    revenueTarget,
                    newLeadTarget,
                    contractTarget,
                    notes: 'Auto-seeded KPI for testing Dashboard logic'
                },
                { upsert: true, new: true }
            );
            console.log(`Seeded KPI for branch ${branch.name}: Revenue Target ${revenueTarget.toLocaleString('vi-VN')} VND`);
        }

        console.log('KPI Seeding completed successfully!');
    } catch (err) {
        console.error('Error seeding KPI:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

seedKPI();
