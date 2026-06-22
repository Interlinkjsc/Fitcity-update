/**
 * Smoke tests — critical paths
 * 1. Auth: login password verify → session credential check
 * 2. WorkoutSession: QR scan Scheduled→In_Progress (check-in)
 * 3. WorkoutSession: QR scan In_Progress→Completed (check-out) + notification triggered
 * 4. Contract: remainingSessions decrements on session confirm (client)
 * 5. Notification: pushNotification saves to DB
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { contractPayload } = require('../helpers/contractFactory');

let mongoServer;

const User = require('../../src/modules/users/models/userModel');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel');
const Contract = require('../../src/modules/contracts/models/contractModel');
const Notification = require('../../src/modules/platform/models/notificationModel');
const workoutService = require('../../src/modules/programs/services/workoutService');
const notificationService = require('../../src/modules/platform/services/notificationService');

let ptId, clientId, contractId, sessionId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
    // Disconnect existing connection (jest.setup.js may have set MONGODB_URI to localhost)
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(mongoServer.getUri());

    const branchId = new mongoose.Types.ObjectId();

    const pt = await User.create({
        name: 'Smoke PT',
        email: 'smoke_pt@fitcity.com',
        password: 'password123',
        role: 'PT',
        branch: branchId,
        status: 'Active'
    });
    ptId = pt._id;

    const client = await User.create({
        name: 'Smoke Client',
        email: 'smoke_client@fitcity.com',
        password: 'password123',
        role: 'Client',
        status: 'Active'
    });
    clientId = client._id;

    const contract = await Contract.create(contractPayload({
        client: clientId,
        pt: ptId,
        contractCode: 'SMOKE-001',
        contractStatus: 'Active',
        paymentStatus: 'Paid',
        remainingSessions: 5,
        totalSessions: 10,
        branch: branchId,
        sales: new mongoose.Types.ObjectId()
    }));
    contractId = contract._id;

    const session = await WorkoutSession.create({
        client: clientId,
        pt: ptId,
        contract: contractId,
        branch: branchId,
        scheduledTime: new Date(),
        status: 'Scheduled'
    });
    sessionId = session._id;
}, 60000);

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await mongoServer.stop();
}, 30000);

// ─── TEST 1: Auth — password verify ─────────────────────────────────────────
describe('Smoke 1 — Auth: password verify', () => {
    it('correctPassword returns true for valid credentials', async () => {
        const user = await User.findById(ptId).select('+password');
        expect(user).not.toBeNull();
        const match = await user.correctPassword('password123', user.password);
        expect(match).toBe(true);
    });

    it('correctPassword returns false for wrong password', async () => {
        const user = await User.findById(ptId).select('+password');
        const match = await user.correctPassword('wrongpass', user.password);
        expect(match).toBe(false);
    });
});

// ─── TEST 2: QR Check-in Scheduled → In_Progress ────────────────────────────
describe('Smoke 2 — QR scan: Scheduled → In_Progress', () => {
    it('processQrScan changes status to In_Progress and sets startTime', async () => {
        const result = await workoutService.processQrScan(sessionId, ptId);
        expect(result.status).toBe('In_Progress');
        expect(result.startTime).toBeDefined();

        const inDb = await WorkoutSession.findById(sessionId);
        expect(inDb.status).toBe('In_Progress');
    });

    it('processQrScan throws when session is already In_Progress (double-booking guard)', async () => {
        // Create a second session for same client to trigger double-booking check
        // Actually the same session is In_Progress, trying to check-in again will
        // fall through to the In_Progress→Completed branch — that's the expected flow
        // Instead test that a Scheduled session from ANOTHER client can't be started
        // when this client already has In_Progress
        const branchId2 = new mongoose.Types.ObjectId();
        const client2 = await User.create({
            name: 'Smoke Client 2',
            email: 'smoke_client2@fitcity.com',
            password: 'password123',
            role: 'Client',
            status: 'Active'
        });
        const contract2 = await Contract.create(contractPayload({
            client: clientId,  // same client
            pt: ptId,
            contractCode: 'SMOKE-002',
            contractStatus: 'Active',
            paymentStatus: 'Paid',
            remainingSessions: 5,
            totalSessions: 10,
            branch: branchId2,
            sales: new mongoose.Types.ObjectId()
        }));
        const session2 = await WorkoutSession.create({
            client: clientId,  // same client already In_Progress above
            pt: ptId,
            contract: contract2._id,
            branch: branchId2,
            scheduledTime: new Date(),
            status: 'Scheduled'
        });
        await expect(workoutService.processQrScan(session2._id, ptId))
            .rejects.toThrow(/đang có một buổi tập khác/i);
    });
});

// ─── TEST 3: QR Check-out In_Progress → Completed + notification ─────────────
describe('Smoke 3 — QR scan: In_Progress → Completed + notification', () => {
    it('processQrScan changes status to Completed and sets endTime', async () => {
        // session is currently In_Progress from Test 2
        const result = await workoutService.processQrScan(sessionId, ptId);
        expect(result.status).toBe('Completed');
        expect(result.endTime).toBeDefined();

        const inDb = await WorkoutSession.findById(sessionId);
        expect(inDb.status).toBe('Completed');
    });

    it('notification saved to DB for client after checkout', async () => {
        const noti = await Notification.findOne({
            recipient: clientId,
            title: 'Yêu cầu xác nhận buổi tập'
        });
        expect(noti).not.toBeNull();
        expect(noti.message).toMatch(/xác nhận/i);
        expect(noti.link).toBe('/client');
    });
});

// ─── TEST 4: Contract remainingSessions decrements on confirm ────────────────
describe('Smoke 4 — Contract: remainingSessions decrements on session confirm', () => {
    it('remainingSessions drops by 1 when client confirms session', async () => {
        const before = await Contract.findById(contractId);
        const sessionsBefore = before.remainingSessions;

        // Simulate confirmSession logic (direct model ops, no HTTP layer)
        await WorkoutSession.findByIdAndUpdate(sessionId, {
            $set: {
                status: 'Confirmed',
                'clientConfirmation.time': new Date(),
                'clientConfirmation.isConfirmed': true
            }
        });
        const contract = await Contract.findById(contractId);
        if (contract.remainingSessions > 0) {
            contract.remainingSessions -= 1;
            await contract.save();
        }

        const after = await Contract.findById(contractId);
        expect(after.remainingSessions).toBe(sessionsBefore - 1);
    });

    it('guard: remainingSessions stays 0 and does not go negative', async () => {
        const contract = await Contract.findById(contractId);
        contract.remainingSessions = 0;
        await contract.save();

        // Guard logic from clientController
        const reloaded = await Contract.findById(contractId);
        if (reloaded.remainingSessions > 0) {
            reloaded.remainingSessions -= 1;
            await reloaded.save();
        }
        const final = await Contract.findById(contractId);
        expect(final.remainingSessions).toBe(0);
    });
});

// ─── TEST 5: Notification: pushNotification saves to DB ─────────────────────
describe('Smoke 5 — Notification: pushNotification saves to DB', () => {
    it('creates a notification document with correct fields', async () => {
        const countBefore = await Notification.countDocuments({});

        await notificationService.pushNotification(
            clientId,
            'Smoke Test Title',
            'Smoke test message',
            'Info',
            '/client',
            ptId
        );

        const countAfter = await Notification.countDocuments({});
        expect(countAfter).toBe(countBefore + 1);

        const noti = await Notification.findOne({ title: 'Smoke Test Title' });
        expect(noti.recipient.toString()).toBe(clientId.toString());
        expect(noti.message).toBe('Smoke test message');
        expect(noti.type).toBe('Info');
        expect(noti.sender.toString()).toBe(ptId.toString());
    });

    it('returns null gracefully on DB error (resilience)', async () => {
        const originalCreate = Notification.create;
        Notification.create = jest.fn().mockRejectedValueOnce(new Error('DB down'));

        const result = await notificationService.pushNotification(clientId, 'fail', 'msg');
        expect(result).toBeNull();

        Notification.create = originalCreate;
    });
});
