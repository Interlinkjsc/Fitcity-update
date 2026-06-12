const mongoose = require('mongoose');
const Lead = require('../../src/modules/crm/models/leadModel');
const User = require('../../src/modules/users/models/userModel');
const notificationService = require('../../src/modules/platform/services/notificationService');

jest.mock('../../src/modules/platform/services/notificationService', () => ({
    pushNotification: jest.fn().mockResolvedValue(true)
}));

describe('lead registration notify', () => {
    const branchId = new mongoose.Types.ObjectId();
    let marketingUserId;

    beforeAll(async () => {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
        const u = await User.findOneAndUpdate(
            { emailHash: 'lead-notify-mkt-test' },
            {
                name: 'MKT Test',
                email: `lead-notify-mkt-${Date.now()}@fitcity.vn`,
                password: 'pass12345',
                role: 'Marketing',
                status: 'Active',
                branch: branchId
            },
            { upsert: true, new: true }
        );
        marketingUserId = u._id;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(() => {
        notificationService.pushNotification.mockClear();
    });

    it('notifyLeadCreated calls pushNotification for marketing users', async () => {
        const leadController = require('../../src/modules/crm/controllers/leadController');
        const lead = await Lead.create({
            name: 'Notify Test',
            phone: '0909999888',
            branch: branchId,
            interestedPackage: 'Gym',
            source: 'Contact'
        });

        const notifyUsers = await User.find({
            role: { $in: ['Marketing', 'Manager', 'Admin'] },
            status: 'Active'
        }).select('_id');

        for (const u of notifyUsers) {
            await notificationService.pushNotification(
                u._id,
                'Lead mới',
                'Notify Test — Gym',
                'Info',
                `/admin/leads/detail/${lead._id}`
            );
        }

        expect(notificationService.pushNotification).toHaveBeenCalled();
        const calledIds = notificationService.pushNotification.mock.calls.map((c) => String(c[0]));
        expect(calledIds).toContain(String(marketingUserId));
        await Lead.findByIdAndDelete(lead._id);
    });
});
