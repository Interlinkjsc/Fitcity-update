const mongoose = require('mongoose');
const User = require('../../src/modules/users/models/userModel.js');
const BodyMetric = require('../../src/modules/programs/models/bodyMetricModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('Body Metric Business Logic Tests', () => {
    let clientId;
    let ptId;

    beforeAll(async () => {
        const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fitcity_test';
        await mongoose.connect(dbUri);
        
        await User.deleteMany({});
        await BodyMetric.deleteMany({});

        // Create Admin (doesn't need branch)
        const pt = await User.create({
            name: 'Pro Trainer',
            email: 'pt@fitcity.com',
            password: 'password123',
            role: 'Admin' 
        });
        ptId = pt._id;

        const client = await User.create({
            name: 'Fitness Client',
            email: 'client@gmail.com',
            password: 'password123',
            role: 'Admin'
        });
        clientId = client._id;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('Should calculate BMI automatically on save (70kg/175cm = 22.9)', async () => {
        const metric = await BodyMetric.create({
            client: clientId,
            pt: ptId,
            weight: 70, 
            height: 175  
        });

        expect(Number(metric.bmi)).toEqual(22.9);
    });

    test('Should capture measurements correctly', async () => {
        const metric = await BodyMetric.create({
            client: clientId,
            pt: ptId,
            weight: 75,
            height: 180,
            measurements: {
                waist: 85,
                chest: 100
            }
        });

        expect(metric.measurements.waist).toBe(85);
        expect(metric.measurements.chest).toBe(100);
    });
});
