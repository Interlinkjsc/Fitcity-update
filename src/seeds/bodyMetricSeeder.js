
const mongoose = require('mongoose');
const User = require('../modules/users/models/userModel.js');
const BodyMetric = require('../modules/programs/models/bodyMetricModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity';

async function seedBodyMetrics() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to DB for BodyMetric seeding');

        // Find PT and Client
        const pt = await User.findOne({ role: 'PT' });
        const client = await User.findOne({ role: 'Client' });

        if (!pt || !client) {
            console.error('❌ Could not find PT or Client. Please run fmsSeeder.js first.');
            process.exit(1);
        }

        // Clear existing metrics for this client
        await BodyMetric.deleteMany({ client: client._id });

        const metricsData = [];
        const now = new Date();
        
        // Generate 6 months of data
        for (let i = 0; i < 6; i++) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - (5 - i));
            
            // Progressively improving metrics
            const weight = 85 - (i * 1.5) + (Math.random() - 0.5); // 85kg -> 77.5kg
            const height = 175;
            const bodyFat = 25 - (i * 1.2) + (Math.random() - 0.5); // 25% -> 19%
            const muscleMass = 32 + (i * 0.4); // 32kg -> 34kg
            
            // Manually calculate BMI since insertMany bypasses pre-save hooks
            const bmi = Number((weight / ((height/100) * (height/100))).toFixed(1));

            metricsData.push({
                client: client._id,
                pt: pt._id,
                date: date,
                weight: Number(weight.toFixed(1)),
                height: height,
                bmi: bmi,
                bodyFat: Number(bodyFat.toFixed(1)),
                muscleMass: Number(muscleMass.toFixed(1)),
                visceralFat: 12 - Math.floor(i / 2),
                water: 55 + (i * 0.5),
                measurements: {
                    chest: 105 - (i * 0.5),
                    waist: 95 - (i * 2),
                    hips: 102 - (i * 1),
                    bicep: 35 + (i * 0.3),
                    thigh: 60 - (i * 0.5)
                },
                notes: `Tiến độ tháng thứ ${i+1}. Khách hàng tuân thủ thực đơn tốt.`
            });
        }

        await BodyMetric.insertMany(metricsData);
        console.log('✅ SEEDED 6 MONTHS OF BODY METRICS FOR:', client.name);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ SEEDING ERROR:', error);
        process.exit(1);
    }
}

seedBodyMetrics();
