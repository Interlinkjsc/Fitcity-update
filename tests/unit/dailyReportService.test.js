const mongoose = require('mongoose');
const dailyReportService = require('../../src/modules/platform/services/dailyReportService');
const DailyReport = require('../../src/modules/platform/models/dailyReportModel');
const User = require('../../src/modules/users/models/userModel');

describe('dailyReportService', () => {
    beforeAll(async () => {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await DailyReport.deleteMany({});
        await User.deleteMany({ email: /dailyreport-test/ });
    });

    it('submitReport creates pending report', async () => {
        const email = `dailyreport-test-${Date.now()}@fitcity.vn`;
        const user = await User.create({
            name: 'DR Test',
            email,
            password: 'pass12345',
            role: 'PT',
            status: 'Active'
        });
        const branchId = new mongoose.Types.ObjectId();
        const doc = await dailyReportService.submitReport(user._id, branchId, {
            summary: 'Dạy 5 buổi',
            reportDate: new Date()
        });
        expect(doc.status).toBe('Pending_Approval');
        expect(doc.summary).toBe('Dạy 5 buổi');
    });

    it('getCompletionStats returns rate object', async () => {
        const stats = await dailyReportService.getCompletionStats({
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
        });
        expect(stats).toHaveProperty('completionRatePercent');
        expect(stats).toHaveProperty('staffCount');
    });
});
