const mongoose = require('mongoose');
const ptLeaveService = require('../../src/modules/pt/services/ptLeaveService');
const PTLeaveRequest = require('../../src/modules/pt/models/ptLeaveRequestModel');
const Contract = require('../../src/modules/contracts/models/contractModel');
const User = require('../../src/modules/users/models/userModel');

describe('ptLeaveService', () => {
    const ptId = new mongoose.Types.ObjectId();
    const replacementId = new mongoose.Types.ObjectId();
    const branchId = new mongoose.Types.ObjectId();
    const clientId = new mongoose.Types.ObjectId();
    const salesId = new mongoose.Types.ObjectId();

    beforeAll(async () => {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await PTLeaveRequest.deleteMany({});
        await Contract.deleteMany({ contractCode: /^LEAVE-TEST/ });
        await User.findOneAndUpdate(
            { _id: replacementId },
            {
                name: 'PT Replace',
                email: `leave-test-replace-${Date.now()}@fitcity.vn`,
                password: 'pass12345',
                role: 'PT',
                status: 'Active',
                branch: branchId
            },
            { upsert: true, new: true }
        );
    });

    it('approveWithReassign updates contracts', async () => {
        await Contract.create({
            contractCode: 'LEAVE-TEST-001',
            client: clientId,
            branch: branchId,
            sales: salesId,
            pt: ptId,
            packageSnapshot: {
                name: 'Gói test',
                type: 'PT',
                duration: 30,
                durationMonths: 1,
                sessions: 10,
                price: 100000,
                isCustom: false
            },
            basePrice: 1000000,
            totalAmount: 1100000,
            endDate: new Date(Date.now() + 86400000 * 30),
            contractStatus: 'Active',
            totalSessions: 10,
            remainingSessions: 10
        });

        const req = await PTLeaveRequest.create({
            pt: ptId,
            branch: branchId,
            startDate: new Date(),
            endDate: new Date(Date.now() + 86400000 * 7),
            reason: 'Nghỉ phép'
        });

        const updated = await ptLeaveService.approveWithReassign(req._id, new mongoose.Types.ObjectId(), {
            replacementPtId: replacementId
        });

        expect(updated.status).toBe('Approved');
        expect(updated.contractsReassigned).toBe(1);

        const c = await Contract.findOne({ contractCode: 'LEAVE-TEST-001' });
        expect(c.pt.toString()).toBe(replacementId.toString());
    });
});
