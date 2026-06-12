const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Reward = require('../../src/modules/programs/models/rewardModel.js');
const Notification = require('../../src/modules/platform/models/notificationModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const rewardService = require('../../src/modules/programs/services/rewardService.js');

const mockClient = new mongoose.Types.ObjectId();
const mockAdmin = new mongoose.Types.ObjectId();

describe('Reward Service - Assign & Notify', () => {
    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        await Reward.deleteMany({});
        await Notification.deleteMany({});
    });

    afterAll(async () => {
        await Reward.deleteMany({});
        await Notification.deleteMany({});
        await mongoose.connection.close();
    });

    it('Should assign a reward to a client and send notification', async () => {
        const reward = await rewardService.assignReward({
            clientId: mockClient,
            type: 'Voucher',
            title: 'Giảm 20% gói Gym',
            description: 'Ưu đãi thành viên VIP',
            value: 200000,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            assignedBy: mockAdmin
        });

        expect(reward).toBeDefined();
        expect(reward.client.toString()).toBe(mockClient.toString());
        expect(reward.type).toBe('Voucher');
        expect(reward.status).toBe('Active');
        expect(reward.value).toBe(200000);

        // Verify notification was sent
        const noti = await Notification.findOne({ recipient: mockClient });
        expect(noti).toBeDefined();
        expect(noti.title).toContain('phần thưởng');
        expect(noti.type).toBe('Success');
    });

    it('Should use a reward and mark as Used', async () => {
        const reward = await Reward.findOne({ client: mockClient, status: 'Active' });
        const used = await rewardService.useReward(reward._id, mockClient);

        expect(used.status).toBe('Used');
        expect(used.usedAt).toBeDefined();
    });

    it('Should reject using an already-used reward', async () => {
        const reward = await Reward.findOne({ client: mockClient, status: 'Used' });
        await expect(
            rewardService.useReward(reward._id, mockClient)
        ).rejects.toThrow('không khả dụng');
    });

    it('Should reject expired reward', async () => {
        const expiredReward = await Reward.create({
            client: mockClient,
            type: 'Gift',
            title: 'Quà cũ',
            value: 50000,
            expiresAt: new Date(Date.now() - 1000), // Already expired
            assignedBy: mockAdmin,
            status: 'Active'
        });

        await expect(
            rewardService.useReward(expiredReward._id, mockClient)
        ).rejects.toThrow('hết hạn');
    });

    it('Should list all rewards for a client', async () => {
        const rewards = await rewardService.getClientRewards(mockClient);
        expect(rewards.length).toBeGreaterThanOrEqual(2);
    });

    it('Should filter rewards by status (Admin)', async () => {
        const usedRewards = await rewardService.getAllRewards({ status: 'Used' });
        expect(usedRewards.every(r => r.status === 'Used')).toBe(true);
    });
});
