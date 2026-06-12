/**
 * Đường B — CRM: Convert Lead → User Client (POST /admin/leads/detail/:id/convert)
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Lead = require('../../src/modules/crm/models/leadModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const { hash } = require('../../src/utils/encryption.js');

const BRANCH_NAME = 'Branch_IT_LeadConvert_B';
const ADMIN_EMAIL = 'lead_b_admin@test.local';
const LEAD_EMAIL = 'path_b_from_lead@test.local';
const LEAD_NAME = 'IT Path B From Lead';

describe('POST /admin/leads/detail/:id/convert (Path B)', () => {
    let branchId;
    let adminCookie;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        await User.deleteMany({
            emailHash: { $in: [hash(ADMIN_EMAIL), hash(LEAD_EMAIL)] }
        });
        await Branch.deleteMany({ name: BRANCH_NAME });
        await Lead.deleteMany({ name: LEAD_NAME });

        const br = await Branch.create({
            name: BRANCH_NAME,
            address: 'Convert test st',
            phone: '0289990001',
            status: 'Open'
        });
        branchId = br._id;

        await User.create({
            name: 'Lead B Admin',
            email: ADMIN_EMAIL,
            password: 'password123',
            role: 'Admin',
            status: 'Active',
            branch: branchId
        });

        const login = await request(app)
            .post('/auth/login')
            .send({ email: ADMIN_EMAIL, password: 'password123' });
        adminCookie = login.headers['set-cookie'];
        expect(login.statusCode).toBe(302);
    });

    afterAll(async () => {
        await Lead.deleteMany({ name: LEAD_NAME });
        await User.deleteMany({
            emailHash: { $in: [hash(ADMIN_EMAIL), hash(LEAD_EMAIL)] }
        });
        await Branch.deleteMany({ name: BRANCH_NAME });
        await mongoose.connection.close();
    });

    afterEach(async () => {
        await Lead.deleteMany({ name: LEAD_NAME });
        await User.deleteMany({ emailHash: hash(LEAD_EMAIL) });
    });

    it('creates Client and sets Lead to Converted with convertedClientId', async () => {
        const lead = await Lead.create({
            name: LEAD_NAME,
            phone: '0909666777',
            email: LEAD_EMAIL,
            branch: branchId,
            source: 'Website',
            status: 'Contacted'
        });

        const res = await request(app)
            .post(`/admin/leads/detail/${lead._id}/convert`)
            .set('Cookie', adminCookie)
            .type('form')
            .send({ password: 'secret12', confirmPassword: 'secret12' });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe(`/admin/leads/detail/${lead._id}`);

        const updated = await Lead.findById(lead._id).lean();
        expect(updated.status).toBe('Converted');
        expect(updated.convertedClientId).toBeTruthy();

        const client = await User.findOne({ emailHash: hash(LEAD_EMAIL), role: 'Client' }).lean();
        expect(client).toBeTruthy();
        expect(String(client._id)).toBe(String(updated.convertedClientId));
    });

    it('does not convert twice (no duplicate Client)', async () => {
        const lead = await Lead.create({
            name: LEAD_NAME,
            phone: '0909666888',
            email: LEAD_EMAIL,
            branch: branchId,
            source: 'Walk-in',
            status: 'F'
        });

        const first = await request(app)
            .post(`/admin/leads/detail/${lead._id}/convert`)
            .set('Cookie', adminCookie)
            .type('form')
            .send({ password: 'secret12', confirmPassword: 'secret12' });
        expect(first.statusCode).toBe(302);

        const second = await request(app)
            .post(`/admin/leads/detail/${lead._id}/convert`)
            .set('Cookie', adminCookie)
            .type('form')
            .send({ password: 'otherpwd1', confirmPassword: 'otherpwd1' });
        expect(second.statusCode).toBe(302);

        const nClients = await User.countDocuments({ emailHash: hash(LEAD_EMAIL), role: 'Client' });
        expect(nClients).toBe(1);
    });

    it('fails convert when email already exists as Client', async () => {
        await User.create({
            name: 'Pre-existing Client',
            email: LEAD_EMAIL,
            password: '123456',
            role: 'Client',
            branch: branchId,
            status: 'Active'
        });

        const lead = await Lead.create({
            name: LEAD_NAME,
            phone: '0909666999',
            email: LEAD_EMAIL,
            branch: branchId,
            source: 'Website',
            status: 'Contacted'
        });

        const res = await request(app)
            .post(`/admin/leads/detail/${lead._id}/convert`)
            .set('Cookie', adminCookie)
            .type('form')
            .send({ password: 'secret12', confirmPassword: 'secret12' });

        expect(res.statusCode).toBe(302);

        const updated = await Lead.findById(lead._id).lean();
        expect(updated.status).not.toBe('Converted');
        expect(updated.convertedClientId == null || !updated.convertedClientId).toBe(true);
    });

    it('returns 302 to login when not authenticated', async () => {
        const lead = await Lead.create({
            name: LEAD_NAME,
            phone: '0909666000',
            email: LEAD_EMAIL,
            branch: branchId,
            source: 'Website',
            status: 'F'
        });

        const res = await request(app)
            .post(`/admin/leads/detail/${lead._id}/convert`)
            .type('form')
            .send({ password: 'secret12', confirmPassword: 'secret12' });

        expect(res.statusCode).toBe(401);
    });
});
