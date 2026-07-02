const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const app = require('../../src/app');

const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('ACT-13 PT-Client interaction end-to-end', () => {
    let ptCookie;
    let otherPtCookie;
    let clientCookie;
    let branch;
    let pt;
    let otherPt;
    let client;
    let otherClientCookie;
    let otherClient;
    let servicePackage;
    let contract;

    beforeAll(async () => {
        process.env.QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || 'test_qr_secret_123';
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const uniq = Date.now();
        const ptEmail = `pt_act13_${uniq}@fitcity.com`;
        const otherPtEmail = `pt_act13_other_${uniq}@fitcity.com`;
        const clientEmail = `client_act13_${uniq}@fitcity.com`;
        const otherClientEmail = `client_act13_other_${uniq}@fitcity.com`;

        const { hash } = require('../../src/utils/encryption');
        await User.deleteMany({
            emailHash: { $in: [hash(ptEmail), hash(otherPtEmail), hash(clientEmail), hash(otherClientEmail)] }
        });
        await Branch.deleteMany({ name: `Branch_ACT13_${uniq}` });
        await ServicePackage.deleteMany({ name: `Pack_ACT13_${uniq}` });

        branch = await Branch.create({
            name: `Branch_ACT13_${uniq}`,
            address: 'Test address',
            phone: '0900000000',
            status: 'Open'
        });

        pt = await User.create({
            name: 'PT ACT13',
            email: ptEmail,
            password: 'password123',
            role: 'PT',
            status: 'Active',
            branch: branch._id
        });
        otherPt = await User.create({
            name: 'PT ACT13 OTHER',
            email: otherPtEmail,
            password: 'password123',
            role: 'PT',
            status: 'Active',
            branch: branch._id
        });

        client = await User.create({
            name: 'Client ACT13',
            email: clientEmail,
            password: 'password123',
            role: 'Client',
            status: 'Active',
            branch: branch._id
        });
        otherClient = await User.create({
            name: 'Client ACT13 OTHER',
            email: otherClientEmail,
            password: 'password123',
            role: 'Client',
            status: 'Active',
            branch: branch._id
        });

        servicePackage = await ServicePackage.create({
            name: `Pack_ACT13_${uniq}`,
            type: 'Gym',
            price: 1000000,
            duration: 30,
            sessions: 10
        });

        contract = await Contract.create({
            client: client._id,
            pt: pt._id,
            sales: pt._id,
            branch: branch._id,
            servicePackage: servicePackage._id,
            totalSessions: 10,
            remainingSessions: 10,
            basePrice: 1000000,
            discount: 0,
            netAmount: 1000000,
            totalAmount: 1100000,
            contractStatus: 'Active',
            paymentStatus: 'Paid',
            startDate: new Date(),
            packageSnapshot: {
                name: 'Gói Test ACT13',
                price: 1000000,
                duration: 30
            },
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        const ptLogin = await request(app).post('/auth/login').send({ email: ptEmail, password: 'password123' });
        ptCookie = ptLogin.headers['set-cookie'];
        const otherPtLogin = await request(app).post('/auth/login').send({ email: otherPtEmail, password: 'password123' });
        otherPtCookie = otherPtLogin.headers['set-cookie'];

        const clientLogin = await request(app).post('/auth/login').send({ email: clientEmail, password: 'password123' });
        clientCookie = clientLogin.headers['set-cookie'];
        const otherClientLogin = await request(app)
            .post('/auth/login')
            .send({ email: otherClientEmail, password: 'password123' });
        otherClientCookie = otherClientLogin.headers['set-cookie'];
    });

    afterAll(async () => {
        await WorkoutSession.deleteMany({ client: client?._id, pt: pt?._id });
        if (contract?._id) await Contract.deleteMany({ _id: contract._id });
        if (servicePackage?._id) await ServicePackage.deleteMany({ _id: servicePackage._id });
        if (branch?._id) await Branch.deleteMany({ _id: branch._id });
        if (pt?._id) await User.deleteMany({ _id: pt._id });
        if (otherPt?._id) await User.deleteMany({ _id: otherPt._id });
        if (client?._id) await User.deleteMany({ _id: client._id });
        if (otherClient?._id) await User.deleteMany({ _id: otherClient._id });
        await mongoose.connection.close();
    });

    it('should complete full training lifecycle: Scheduled -> In_Progress -> Completed -> Confirmed', async () => {
        const session = await WorkoutSession.create({
            client: client._id,
            pt: pt._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: new Date(Date.now() + 60 * 60 * 1000),
            status: 'Scheduled'
        });

        const { signQrToken } = require('../../src/utils/qrToken');
        const startToken = signQrToken({
            sid: session._id,
            act: 'start',
            cid: client._id,
            pid: pt._id,
            ttlSeconds: 60
        });

        const startRes = await request(app)
            .post('/pt/sessions/scan-qr')
            .set('Cookie', ptCookie)
            .send({ token: startToken });
        expect(startRes.statusCode).toBe(302);

        const inProgress = await WorkoutSession.findById(session._id);
        expect(inProgress.status).toBe('In_Progress');

        const endToken = signQrToken({
            sid: session._id,
            act: 'end',
            cid: client._id,
            pid: pt._id,
            ttlSeconds: 60
        });

        const endRes = await request(app)
            .post('/pt/sessions/scan-qr')
            .set('Cookie', ptCookie)
            .send({ token: endToken });
        expect(endRes.statusCode).toBe(302);

        const completed = await WorkoutSession.findById(session._id);
        expect(completed.status).toBe('Completed');

        const contractBeforeConfirm = await Contract.findById(contract._id);
        expect(contractBeforeConfirm.remainingSessions).toBe(10);

        const confirmRes = await request(app)
            .post(`/client/sessions/confirm/${session._id}`)
            .set('Cookie', clientCookie)
            .send({});
        expect(confirmRes.statusCode).toBe(302);

        const confirmed = await WorkoutSession.findById(session._id);
        expect(confirmed.status).toBe('Confirmed');
        expect(confirmed.clientConfirmation?.isConfirmed).toBe(true);

        const contractAfterConfirm = await Contract.findById(contract._id);
        expect(contractAfterConfirm.remainingSessions).toBe(9);
    });

    it('should handle cancel request rejection: Scheduled -> Cancel_Requested -> Scheduled', async () => {
        const session = await WorkoutSession.create({
            client: client._id,
            pt: pt._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            status: 'Scheduled'
        });

        const cancelReqRes = await request(app)
            .post(`/client/sessions/${session._id}/cancel-request`)
            .set('Cookie', clientCookie)
            .send({});
        expect(cancelReqRes.statusCode).toBe(302);

        const requested = await WorkoutSession.findById(session._id);
        expect(requested.status).toBe('Cancel_Requested');

        const rejectRes = await request(app)
            .post(`/pt/sessions/${session._id}/reject-cancel`)
            .set('Cookie', ptCookie)
            .send({});
        expect(rejectRes.statusCode).toBe(302);

        const rejected = await WorkoutSession.findById(session._id);
        expect(rejected.status).toBe('Scheduled');
    });

    it('should handle cancel request acceptance: Scheduled -> Cancel_Requested -> Cancelled', async () => {
        const session = await WorkoutSession.create({
            client: client._id,
            pt: pt._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
            status: 'Scheduled'
        });

        const cancelReqRes = await request(app)
            .post(`/client/sessions/${session._id}/cancel-request`)
            .set('Cookie', clientCookie)
            .send({});
        expect(cancelReqRes.statusCode).toBe(302);

        const requested = await WorkoutSession.findById(session._id);
        expect(requested.status).toBe('Cancel_Requested');

        const acceptRes = await request(app)
            .post(`/pt/sessions/${session._id}/accept-cancel`)
            .set('Cookie', ptCookie)
            .send({});
        expect(acceptRes.statusCode).toBe(302);

        const cancelled = await WorkoutSession.findById(session._id);
        expect(cancelled.status).toBe('Cancelled');
    });

    it('should reject confirm when session is not Completed', async () => {
        const session = await WorkoutSession.create({
            client: client._id,
            pt: pt._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
            status: 'Scheduled'
        });

        const beforeContract = await Contract.findById(contract._id);
        const res = await request(app)
            .post(`/client/sessions/confirm/${session._id}`)
            .set('Cookie', clientCookie)
            .send({});
        expect(res.statusCode).toBe(302);

        const unchangedSession = await WorkoutSession.findById(session._id);
        expect(unchangedSession.status).toBe('Scheduled');

        const afterContract = await Contract.findById(contract._id);
        expect(afterContract.remainingSessions).toBe(beforeContract.remainingSessions);
    });

    it('should not decrement sessions on duplicate confirm', async () => {
        const session = await WorkoutSession.create({
            client: client._id,
            pt: pt._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
            status: 'Completed',
            clientConfirmation: { isConfirmed: false }
        });

        const firstBefore = await Contract.findById(contract._id);
        const firstConfirm = await request(app)
            .post(`/client/sessions/confirm/${session._id}`)
            .set('Cookie', clientCookie)
            .send({});
        expect(firstConfirm.statusCode).toBe(302);

        const firstAfter = await Contract.findById(contract._id);
        expect(firstAfter.remainingSessions).toBe(firstBefore.remainingSessions - 1);

        const secondConfirm = await request(app)
            .post(`/client/sessions/confirm/${session._id}`)
            .set('Cookie', clientCookie)
            .send({});
        expect(secondConfirm.statusCode).toBe(302);

        const secondAfter = await Contract.findById(contract._id);
        expect(secondAfter.remainingSessions).toBe(firstAfter.remainingSessions);
    });

    it('should forbid cancel decision by another PT', async () => {
        const session = await WorkoutSession.create({
            client: client._id,
            pt: pt._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
            status: 'Cancel_Requested'
        });

        const res = await request(app)
            .post(`/pt/sessions/${session._id}/accept-cancel`)
            .set('Cookie', otherPtCookie)
            .send({});
        expect(res.statusCode).toBe(302);

        const unchanged = await WorkoutSession.findById(session._id);
        expect(unchanged.status).toBe('Cancel_Requested');
    });

    it('should reject cancel request when session already In_Progress', async () => {
        const session = await WorkoutSession.create({
            client: client._id,
            pt: pt._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: new Date(Date.now() + 7 * 60 * 60 * 1000),
            status: 'In_Progress'
        });

        const res = await request(app)
            .post(`/client/sessions/${session._id}/cancel-request`)
            .set('Cookie', clientCookie)
            .send({});
        expect(res.statusCode).toBe(302);

        const unchanged = await WorkoutSession.findById(session._id);
        expect(unchanged.status).toBe('In_Progress');
    });

    it('should forbid another client from confirming a session they do not own', async () => {
        const session = await WorkoutSession.create({
            client: client._id,
            pt: pt._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
            status: 'Completed',
            clientConfirmation: { isConfirmed: false }
        });

        const beforeContract = await Contract.findById(contract._id);
        const res = await request(app)
            .post(`/client/sessions/confirm/${session._id}`)
            .set('Cookie', otherClientCookie)
            .send({});
        expect(res.statusCode).toBe(302);

        const unchanged = await WorkoutSession.findById(session._id);
        expect(unchanged.status).toBe('Completed');
        expect(unchanged.clientConfirmation?.isConfirmed).toBe(false);

        const afterContract = await Contract.findById(contract._id);
        expect(afterContract.remainingSessions).toBe(beforeContract.remainingSessions);
    });

    it('should reject PT cancel decision when session is not Cancel_Requested', async () => {
        const session = await WorkoutSession.create({
            client: client._id,
            pt: pt._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: new Date(Date.now() + 9 * 60 * 60 * 1000),
            status: 'Scheduled'
        });

        const acceptRes = await request(app)
            .post(`/pt/sessions/${session._id}/accept-cancel`)
            .set('Cookie', ptCookie)
            .send({});
        expect(acceptRes.statusCode).toBe(302);

        const rejectRes = await request(app)
            .post(`/pt/sessions/${session._id}/reject-cancel`)
            .set('Cookie', ptCookie)
            .send({});
        expect(rejectRes.statusCode).toBe(302);

        const unchanged = await WorkoutSession.findById(session._id);
        expect(unchanged.status).toBe('Scheduled');
    });

    // ===== Tests for PT Direct Session Creation =====

    it('should allow PT to create a direct session for an active contract client', async () => {
        const scheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        const res = await request(app)
            .post('/pt/sessions/create-direct')
            .set('Cookie', ptCookie)
            .send({
                contractId: contract._id.toString(),
                clientId: client._id.toString(),
                scheduledTime,
                notes: 'Leg day + Cardio'
            });

        expect(res.statusCode).toBe(200);
        const body = res.body;
        expect(body.success).toBe(true);
        expect(body.session).toBeDefined();
        expect(body.session.status).toBe('Scheduled');
        expect(body.session.client.toString()).toBe(client._id.toString());
        expect(body.session.pt.toString()).toBe(pt._id.toString());

        // Verify in DB
        const dbSession = await WorkoutSession.findById(body.session._id);
        expect(dbSession).not.toBeNull();
        expect(dbSession.status).toBe('Scheduled');
        expect(dbSession.notes).toBe('Leg day + Cardio');
    });

    it('should reject direct session creation with invalid contract', async () => {
        const fakeContractId = new (require('mongoose').Types.ObjectId)();
        const scheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        const res = await request(app)
            .post('/pt/sessions/create-direct')
            .set('Cookie', ptCookie)
            .send({
                contractId: fakeContractId.toString(),
                clientId: client._id.toString(),
                scheduledTime
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should reject direct session creation by another PT', async () => {
        const scheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        const res = await request(app)
            .post('/pt/sessions/create-direct')
            .set('Cookie', otherPtCookie)
            .send({
                contractId: contract._id.toString(),
                clientId: client._id.toString(),
                scheduledTime
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
    });
});

