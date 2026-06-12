const mongoose = require('mongoose');
const Lead = require('../../src/modules/crm/models/leadModel');
const { getFunnelCounts } = require('../../src/modules/crm/services/leadFunnelService');

describe('leadFunnelService', () => {
    const branchId = new mongoose.Types.ObjectId();

    beforeAll(async () => {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await Lead.deleteMany({ name: /^Funnel Test / });
    });

    it('getFunnelCounts aggregates by status', async () => {
        const base = {
            branch: branchId,
            interestedPackage: 'Gym',
            source: 'Website'
        };
        await Lead.create([
            { ...base, name: 'Funnel Test A', status: 'F', phone: '0901111111' },
            { ...base, name: 'Funnel Test B', status: 'F', phone: '0902222222' },
            { ...base, name: 'Funnel Test C', status: 'Contacted', phone: '0903333333' },
            { ...base, name: 'Funnel Test D', status: 'Signed', phone: '0904444444' }
        ]);

        const { stages, total } = await getFunnelCounts({ name: /^Funnel Test / });
        expect(total).toBe(4);
        expect(stages.find((s) => s.key === 'F').count).toBe(2);
        expect(stages.find((s) => s.key === 'Contacted').count).toBe(1);
        expect(stages.find((s) => s.key === 'Signed').count).toBe(1);
        expect(stages.find((s) => s.key === 'Converted').count).toBe(0);
        expect(stages.length).toBe(4);
    });
});
