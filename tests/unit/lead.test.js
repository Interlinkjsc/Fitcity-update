const mongoose = require('mongoose');
const Lead = require('../../src/modules/crm/models/leadModel.js');

describe('Lead Enhancement Unit Tests', () => {
    beforeAll(async () => {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        await mongoose.connect(MONGODB_URI);
    });

    afterAll(async () => {
        await Lead.deleteMany();
        await mongoose.connection.close();
    });

    it('Should store initial body metrics in a lead', async () => {
        const branchId = new mongoose.Types.ObjectId();
        const lead = await Lead.create({
            name: 'New Lead',
            phone: '0901234567',
            branch: branchId,
            weight: 85,
            height: 180,
            bodyFat: 25,
            targetGoal: 'Weight Loss'
        });

        expect(lead.weight).toBe(85);
        expect(lead.height).toBe(180);
        expect(lead.targetGoal).toBe('Weight Loss');
    });
});
