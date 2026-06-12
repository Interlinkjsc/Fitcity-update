/**
 * Đường C — Admin tạo Client (GET /admin/clients/create, POST /admin/clients/store)
 */
const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const Lead = require('../../src/modules/crm/models/leadModel.js');
const { hash } = require('../../src/utils/encryption.js');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BRANCH_NAME = 'Branch_IT_Path_C';
const ADMIN_EMAIL = 'path_c_admin@test.local';
const CLIENT_EMAIL = 'path_c_new_client@test.local';
const BLOCK_EMAIL = 'path_c_lead_blocks_store@test.local';

describe('Admin Path C — clients create / store', () => {
    let branchId;
    let adminCookie;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        await User.deleteMany({
            emailHash: { $in: [hash(ADMIN_EMAIL), hash(CLIENT_EMAIL), hash(BLOCK_EMAIL)] }
        });
        await Branch.deleteMany({ name: BRANCH_NAME });
        await Lead.deleteMany({ name: /^IT Path C/ });

        const br = await Branch.create({
            name: BRANCH_NAME,
            address: 'Path C st',
            phone: '0288881111',
            status: 'Open'
        });
        branchId = br._id;

        await User.create({
            name: 'Path C Admin',
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
        await Lead.deleteMany({ name: /^IT Path C/ });
        await User.deleteMany({
            emailHash: { $in: [hash(ADMIN_EMAIL), hash(CLIENT_EMAIL), hash(BLOCK_EMAIL)] }
        });
        await Branch.deleteMany({ name: BRANCH_NAME });
        await mongoose.connection.close();
    });

    afterEach(async () => {
        await User.deleteMany({ emailHash: hash(CLIENT_EMAIL) });
        await Lead.deleteMany({ name: /^IT Path C/ });
    });

    it('GET /admin/clients/create renders when authorized', async () => {
        const res = await request(app).get('/admin/clients/create').set('Cookie', adminCookie);
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Chi nhánh');
    });

    it('R6: blocks store when open Lead has same phone (normalized)', async () => {
        await Lead.deleteMany({ name: 'IT Path C Phone Lead' });
        const lead = await Lead.create({
            name: 'IT Path C Phone Lead',
            phone: '0909444555',
            email: 'path_c_phone_lead@test.local',
            branch: branchId,
            source: 'Website',
            status: 'F'
        });

        const res = await request(app)
            .post('/admin/clients/store')
            .set('Cookie', adminCookie)
            .type('form')
            .send({
                name: 'IT Path C Phone Client',
                email: CLIENT_EMAIL,
                password: 'secret12',
                phone: '0909444555',
                branch: String(branchId),
                status: 'Active'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe(`/admin/leads/detail/${lead._id}`);
        const n = await User.countDocuments({ emailHash: hash(CLIENT_EMAIL), role: 'Client' });
        expect(n).toBe(0);

        await Lead.deleteMany({ name: 'IT Path C Phone Lead' });
    });

    it('POST /admin/clients/store without branch redirects with error', async () => {
        const res = await request(app)
            .post('/admin/clients/store')
            .set('Cookie', adminCookie)
            .type('form')
            .send({
                name: 'No Branch',
                email: CLIENT_EMAIL,
                password: 'secret12',
                status: 'Active'
            });
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/admin/clients/create');
        expect(await User.countDocuments({ emailHash: hash(CLIENT_EMAIL) })).toBe(0);
    });

    it('POST /admin/clients/store creates Client and redirects to list', async () => {
        const res = await request(app)
            .post('/admin/clients/store')
            .set('Cookie', adminCookie)
            .type('form')
            .send({
                name: 'IT Path C Client',
                email: CLIENT_EMAIL,
                password: 'secret12',
                phone: '0909111222',
                branch: String(branchId),
                status: 'Active'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/admin/clients/list');

        const client = await User.findOne({ emailHash: hash(CLIENT_EMAIL), role: 'Client' }).lean();
        expect(client).toBeTruthy();
        expect(client.name).toBe('IT Path C Client');
    });

    it('POST /admin/clients/store rejects duplicate email', async () => {
        await User.create({
            name: 'Existing C',
            email: CLIENT_EMAIL,
            password: '123456',
            role: 'Client',
            branch: branchId,
            status: 'Active'
        });

        const res = await request(app)
            .post('/admin/clients/store')
            .set('Cookie', adminCookie)
            .type('form')
            .send({
                name: 'Dup C',
                email: CLIENT_EMAIL,
                password: 'secret12',
                branch: String(branchId),
                status: 'Active'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/admin/clients/create');

        const count = await User.countDocuments({ emailHash: hash(CLIENT_EMAIL), role: 'Client' });
        expect(count).toBe(1);
    });

    it('R6: blocks store when open Lead has same email (redirect to lead detail)', async () => {
        const lead = await Lead.create({
            name: 'IT Path C Block Lead',
            phone: '0909222333',
            email: BLOCK_EMAIL,
            branch: branchId,
            source: 'Website',
            status: 'Contacted'
        });

        const res = await request(app)
            .post('/admin/clients/store')
            .set('Cookie', adminCookie)
            .type('form')
            .send({
                name: 'IT Path C Should Fail',
                email: BLOCK_EMAIL,
                password: 'secret12',
                branch: String(branchId),
                status: 'Active'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe(`/admin/leads/detail/${lead._id}`);

        const nClients = await User.countDocuments({ emailHash: hash(BLOCK_EMAIL), role: 'Client' });
        expect(nClients).toBe(0);
    });

    it('allows store when Lead is Converted (no open lead for that email)', async () => {
        const existing = await User.create({
            name: 'IT Path C From Convert',
            email: BLOCK_EMAIL,
            password: '123456',
            role: 'Client',
            branch: branchId,
            status: 'Active'
        });

        await Lead.create({
            name: 'IT Path C Converted Lead',
            phone: '0909333444',
            email: BLOCK_EMAIL,
            branch: branchId,
            source: 'Walk-in',
            status: 'Converted',
            convertedClientId: existing._id
        });

        await User.deleteMany({ emailHash: hash(CLIENT_EMAIL) });
        const res = await request(app)
            .post('/admin/clients/store')
            .set('Cookie', adminCookie)
            .type('form')
            .send({
                name: 'IT Path C Fresh',
                email: CLIENT_EMAIL,
                password: 'secret12',
                branch: String(branchId),
                status: 'Active'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/admin/clients/list');
        const client = await User.findOne({ emailHash: hash(CLIENT_EMAIL), role: 'Client' }).lean();
        expect(client).toBeTruthy();

        await User.deleteMany({ emailHash: hash(BLOCK_EMAIL) });
    });

    it('GET /admin/clients/create returns 401 without session', async () => {
        const res = await request(app).get('/admin/clients/create');
        expect(res.statusCode).toBe(401);
    });
});
