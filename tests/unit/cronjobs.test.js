const mongoose = require('mongoose');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const cron = require('node-cron');
const { startCronJobs } = require('../../src/cron/cronjobs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

jest.mock('node-cron', () => ({
    schedule: jest.fn()
}));

const { contractPayload } = require('../helpers/contractFactory');

describe('CronJobs Logic - Contract Liquidation', () => {
    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        await Contract.deleteMany({});
    });

    afterAll(async () => {
        await Contract.deleteMany({});
        await mongoose.connection.close();
    });

    it('Should liquidate unpaid contracts older than 15 days', async () => {
        // Create an unpaid contract 16 days ago
        const oldDate = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000);
        const c1 = await Contract.create(contractPayload({
            paymentStatus: 'Unpaid',
            contractStatus: 'Draft',
            startDate: oldDate,
            endDate: new Date(oldDate.getTime() + 30 * 24 * 60 * 60 * 1000),
            paymentDeadline: oldDate,
            createdAt: oldDate
        }));

        // Initialize cron (adds the callback to the mock)
        startCronJobs();
        const cronCallback = cron.schedule.mock.calls[0][1];

        // Manually trigger the cron callback
        await cronCallback();

        const updated = await Contract.findById(c1._id);
        expect(updated.contractStatus).toBe('Liquidated');
        expect(updated.notes).toContain('Tự động thanh lý do không đóng đủ tiền sau 15 ngày');
    });

    it('Should liquidate paused contracts older than 12 months', async () => {
        const thirteenMonthsAgo = new Date(Date.now() - 395 * 24 * 60 * 60 * 1000);
        const c2 = await Contract.create(contractPayload({
            paymentStatus: 'Paid',
            contractStatus: 'Paused',
            isFrozen: true,
            frozenAt: thirteenMonthsAgo,
            startDate: thirteenMonthsAgo,
            endDate: new Date(),
            createdAt: thirteenMonthsAgo,
            updatedAt: thirteenMonthsAgo,
            pauseHistory: [{
                startDate: thirteenMonthsAgo,
                endDate: new Date(thirteenMonthsAgo.getTime() + 30 * 24 * 60 * 60 * 1000),
                duration: 30,
                reason: 'Old Pause'
            }]
        }));

        startCronJobs();
        // Since both jobs combine into one cron.schedule call
        const cronCallback = cron.schedule.mock.calls[0][1];
        await cronCallback();

        const updated = await Contract.findById(c2._id);
        expect(updated.contractStatus).toBe('Liquidated');
        expect(updated.notes).toContain('Tự động thanh lý do bảo lưu quá hạn 12 tháng');
    });
});
