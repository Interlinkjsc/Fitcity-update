const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('PT Contract Permissions', () => {
    let ptCookie;
    let mockBranch;
    let mockPt;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const { hash } = require('../../src/utils/encryption');
        await User.deleteMany({ emailHash: hash('pt_permission@test.com') });
        await Branch.deleteMany({ name: 'TEST_BRANCH_PERM' });

        mockBranch = await Branch.create({ name: 'TEST_BRANCH_PERM', address: '123 ABC', phone: '0901234567' });
        mockPt = await User.create({ name: 'PT Perm', email: 'pt_permission@test.com', password: 'password123', role: 'PT', status: 'Active', branch: mockBranch._id });

        const res = await request(app).post('/auth/login').send({ email: 'pt_permission@test.com', password: 'password123' });
        ptCookie = res.headers['set-cookie'];
    });

    afterAll(async () => {
        const { hash } = require('../../src/utils/encryption');
        await User.deleteMany({ emailHash: hash('pt_permission@test.com') });
        await Branch.deleteMany({ name: 'TEST_BRANCH_PERM' });
        await mongoose.connection.close();
    });

    it('Should allow PT to CREATE contract (POST /pt/contracts/store)', async () => {
        // Route is /pt/contracts/store (form submission → redirect 302)
        const res = await request(app)
            .post('/pt/contracts/store')
            .set('Cookie', ptCookie);
        // PT has access to this route (form submit → redirect back with validation error or success)
        expect(res.statusCode).toBe(302);
        expect(res.header.location).toMatch(/\/pt\/contracts\//);
    });

    it('Should NOT allow PT to UPDATE contract — no PUT route exists (404)', async () => {
        const dummyId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .put(`/pt/contracts/${dummyId}`)
            .set('Cookie', ptCookie)
            .send({ branchId: mockBranch._id });
        // No PUT route for PT contracts → returns 404 (not 403, but confirms no update access)
        expect(res.statusCode).toBe(404);
    });
});
