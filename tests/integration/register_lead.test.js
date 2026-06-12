/**
 * Đường A — Guest đăng ký Lead (POST /register-lead)
 * Không tạo User Client; chỉ Lead + redirect + (optional) notifications.
 * R1: email đã là tài khoản Client → không tạo Lead, flash + redirect login/contact.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Lead = require('../../src/modules/crm/models/leadModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const { hash } = require('../../src/utils/encryption.js');

const BRANCH_NAME = 'Branch_IT_RegisterLead_A';
const LEAD_NAME_PREFIX = 'IT Path A';
const R1_CLIENT_EMAIL = 'path_a_r1_existing_client@test.local';

describe('POST /register-lead (Path A — Lead funnel)', () => {
    let branchId;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        await Lead.deleteMany({ name: new RegExp(`^${LEAD_NAME_PREFIX}`) });
        await Branch.deleteMany({ name: BRANCH_NAME });
        const br = await Branch.create({
            name: BRANCH_NAME,
            address: '1 Test St',
            phone: '0281234567',
            status: 'Open'
        });
        branchId = br._id.toString();
    });

    afterAll(async () => {
        await Lead.deleteMany({ name: new RegExp(`^${LEAD_NAME_PREFIX}`) });
        await User.deleteMany({ emailHash: hash(R1_CLIENT_EMAIL) });
        await Branch.deleteMany({ name: BRANCH_NAME });
        await mongoose.connection.close();
    });

    afterEach(async () => {
        await Lead.deleteMany({ name: new RegExp(`^${LEAD_NAME_PREFIX}`) });
    });

    it('should 302 to /#trial and create Lead (Website source, default package)', async () => {
        const uniquePhone = '0909123456';
        const res = await request(app)
            .post('/register-lead')
            .type('form')
            .send({
                name: `${LEAD_NAME_PREFIX} Website`,
                phone: uniquePhone,
                email: 'path_a_website@test.local',
                branchId,
                interestedPackage: 'Gym',
                source: 'Website'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/#trial');

        const lead = await Lead.findOne({ name: `${LEAD_NAME_PREFIX} Website` }).lean();
        expect(lead).toBeTruthy();
        expect(lead.status).toBe('F');
        expect(lead.interestedPackage).toBe('Gym');
        expect(lead.source).toBe('Website');
        expect(lead.branch.toString()).toBe(branchId);

        const usersWithEmail = await User.countDocuments({
            emailHash: hash('path_a_website@test.local')
        });
        expect(usersWithEmail).toBe(0);
    });

    it('R1: should 302 to /auth/login and not create Lead when email is already a Client', async () => {
        await User.deleteMany({ emailHash: hash(R1_CLIENT_EMAIL) });
        await User.create({
            name: `${LEAD_NAME_PREFIX} Existing Client`,
            email: R1_CLIENT_EMAIL,
            password: '123456',
            role: 'Client',
            branch: branchId,
            status: 'Active'
        });

        const res = await request(app)
            .post('/register-lead')
            .type('form')
            .send({
                name: `${LEAD_NAME_PREFIX} R1 Block`,
                phone: '0909123999',
                email: R1_CLIENT_EMAIL,
                branchId,
                source: 'Website',
                interestedPackage: 'Gym'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/auth/login');

        const lead = await Lead.findOne({ name: `${LEAD_NAME_PREFIX} R1 Block` });
        expect(lead).toBeNull();

        await User.deleteMany({ emailHash: hash(R1_CLIENT_EMAIL) });
    });

    it('R1: should 302 to /contact when email is Client and source is Contact', async () => {
        await User.deleteMany({ emailHash: hash(R1_CLIENT_EMAIL) });
        await User.create({
            name: `${LEAD_NAME_PREFIX} Existing Client 2`,
            email: R1_CLIENT_EMAIL,
            password: '123456',
            role: 'Client',
            branch: branchId,
            status: 'Active'
        });

        const res = await request(app)
            .post('/register-lead')
            .type('form')
            .send({
                name: `${LEAD_NAME_PREFIX} R1 Contact`,
                phone: '0909123998',
                email: R1_CLIENT_EMAIL,
                branchId,
                source: 'Contact',
                interestedPackage: 'Gym'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/contact');

        const lead = await Lead.findOne({ name: `${LEAD_NAME_PREFIX} R1 Contact` });
        expect(lead).toBeNull();

        await User.deleteMany({ emailHash: hash(R1_CLIENT_EMAIL) });
    });

    it('should 302 to /contact when source is Contact', async () => {
        const res = await request(app)
            .post('/register-lead')
            .type('form')
            .send({
                name: `${LEAD_NAME_PREFIX} Contact`,
                phone: '0909123457',
                branchId,
                source: 'Contact',
                interestedPackage: 'Yoga'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/contact');

        const lead = await Lead.findOne({ name: `${LEAD_NAME_PREFIX} Contact` }).lean();
        expect(lead).toBeTruthy();
        expect(lead.source).toBe('Contact');
        expect(lead.interestedPackage).toBe('Yoga');
    });

    it('should honor safe relative redirectTo', async () => {
        const res = await request(app)
            .post('/register-lead')
            .type('form')
            .send({
                name: `${LEAD_NAME_PREFIX} Redirect`,
                phone: '0909123458',
                branchId,
                redirectTo: '/blog',
                source: 'Website'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/blog');
    });

    it('should not redirect to protocol-relative URL (open redirect)', async () => {
        const res = await request(app)
            .post('/register-lead')
            .type('form')
            .send({
                name: `${LEAD_NAME_PREFIX} OpenRedirect`,
                phone: '0909123459',
                branchId,
                redirectTo: '//evil.example/phish',
                source: 'Website'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/#trial');
    });

    it('should 302 to / and not create Lead on invalid phone', async () => {
        const before = await Lead.countDocuments({ name: `${LEAD_NAME_PREFIX} BadPhone` });

        const res = await request(app)
            .post('/register-lead')
            .type('form')
            .send({
                name: `${LEAD_NAME_PREFIX} BadPhone`,
                phone: '123',
                branchId,
                source: 'Website'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');

        const after = await Lead.countDocuments({ name: `${LEAD_NAME_PREFIX} BadPhone` });
        expect(after).toBe(before);
    });

    it('should 302 to / and not create Lead when branch is missing', async () => {
        const res = await request(app)
            .post('/register-lead')
            .type('form')
            .send({
                name: `${LEAD_NAME_PREFIX} NoBranch`,
                phone: '0909123460',
                source: 'Website'
            });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');

        const lead = await Lead.findOne({ name: `${LEAD_NAME_PREFIX} NoBranch` });
        expect(lead).toBeNull();
    });
});
