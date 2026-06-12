const mongoose = require('mongoose');
const User = require('../../src/modules/users/models/userModel');
const Contract = require('../../src/modules/contracts/models/contractModel');
const AffiliateRewardLog = require('../../src/modules/programs/models/affiliateRewardLogModel');
const Reward = require('../../src/modules/programs/models/rewardModel');
const affiliateService = require('../../src/modules/programs/services/affiliateService');

jest.mock('../../src/modules/platform/services/notificationService', () => ({
    pushNotification: jest.fn().mockResolvedValue(true)
}));

describe('affiliateService', () => {
    const branchId = new mongoose.Types.ObjectId();
    let referrerId;
    let referredId;
    let adminId;

    beforeAll(async () => {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        if (mongoose.connection.readyState === 0) await mongoose.connect(uri);

        const admin = await User.findOneAndUpdate(
            { emailHash: 'affiliate-test-admin' },
            {
                name: 'Admin Aff',
                email: `aff-admin-${Date.now()}@fitcity.vn`,
                password: 'pass12345',
                role: 'Admin',
                status: 'Active',
                branch: branchId
            },
            { upsert: true, new: true }
        );
        adminId = admin._id;

        const referrer = await User.findOneAndUpdate(
            { emailHash: 'affiliate-test-referrer' },
            {
                name: 'Referrer',
                email: `aff-ref-${Date.now()}@fitcity.vn`,
                password: 'pass12345',
                role: 'Client',
                status: 'Active',
                branch: branchId,
                referralCode: `REF${Date.now().toString(36).slice(-6).toUpperCase()}`
            },
            { upsert: true, new: true }
        );
        referrerId = referrer._id;

        const referred = await User.findOneAndUpdate(
            { emailHash: 'affiliate-test-referred' },
            {
                name: 'Referred',
                email: `aff-new-${Date.now()}@fitcity.vn`,
                password: 'pass12345',
                role: 'Client',
                status: 'Active',
                branch: branchId,
                referredBy: referrerId
            },
            { upsert: true, new: true }
        );
        referredId = referred._id;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await AffiliateRewardLog.deleteMany({ referrer: referrerId });
        await Reward.deleteMany({ client: referrerId, title: /Thưởng giới thiệu/ });
        await Contract.deleteMany({ contractCode: /^AFF-TEST/ });
    });

    it('processReferralRewardOnPaid creates gift reward once', async () => {
        const contract = await Contract.create({
            contractCode: `AFF-TEST-${Date.now()}`,
            client: referredId,
            branch: branchId,
            sales: adminId,
            packageSnapshot: {
                name: 'Gói affiliate test',
                type: 'Gym',
                duration: 30,
                durationMonths: 1,
                sessions: 0,
                price: 1000000,
                isCustom: false
            },
            basePrice: 1000000,
            totalAmount: 1000000,
            paidAmount: 1000000,
            endDate: new Date(Date.now() + 86400000 * 30),
            paymentStatus: 'Paid',
            contractStatus: 'Active'
        });

        const log1 = await affiliateService.processReferralRewardOnPaid(contract);
        const log2 = await affiliateService.processReferralRewardOnPaid(contract);

        expect(log1).toBeTruthy();
        expect(log2._id.toString()).toBe(log1._id.toString());

        const rewards = await Reward.find({ client: referrerId, title: 'Thưởng giới thiệu F1' });
        expect(rewards.length).toBe(1);
        expect(rewards[0].type).toBe('Gift');
    });

    it('getReferralDashboard lists F1 users', async () => {
        const dash = await affiliateService.getReferralDashboard(referrerId);
        expect(dash.referralCode).toBeTruthy();
        expect(dash.f1Users.some((u) => u._id.toString() === referredId.toString())).toBe(true);
    });
});
