const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const { hash } = require('../../src/utils/encryption');
const { connectTestDb, disconnectTestDb } = require('../helpers/testDb');

jest.setTimeout(60000);

describe('Contract list scope (Manager isolation)', () => {
    let branchA, branchB;
    let mgrAgent, contractBOnly;

    beforeAll(async () => {
        await connectTestDb();

        branchA = await Branch.create({ name: 'Scope Branch A', address: 'A', phone: '0901111111' });
        branchB = await Branch.create({ name: 'Scope Branch B', address: 'B', phone: '0902222222' });

        await User.create({
            name: 'Mgr Scope',
            role: 'Manager',
            email: 'mgr_scope@test.com',
            emailHash: hash('mgr_scope@test.com'),
            password: 'Password123!',
            branch: branchA._id,
            status: 'Active'
        });
        const clientB = await User.create({
            name: 'Client B',
            role: 'Client',
            email: 'cli_scope_b@test.com',
            emailHash: hash('cli_scope_b@test.com'),
            password: 'Password123!',
            branch: branchB._id,
            status: 'Active'
        });
        const salesB = await User.create({
            name: 'Sales B',
            role: 'Sales',
            email: 'sales_scope_b@test.com',
            emailHash: hash('sales_scope_b@test.com'),
            password: 'Password123!',
            branch: branchB._id,
            status: 'Active'
        });

        contractBOnly = await Contract.create({
            client: clientB._id,
            sales: salesB._id,
            branch: branchB._id,
            servicePackage: new mongoose.Types.ObjectId(),
            packageSnapshot: { name: 'Pkg', type: 'Gym', duration: 30, sessions: 10, price: 100000 },
            basePrice: 1000000,
            netAmount: 1000000,
            totalAmount: 1100000,
            discount: 0,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 86400000),
            contractStatus: 'Active',
            contractCode: 'SCOPE-B-001'
        });

        mgrAgent = request.agent(app);
        await mgrAgent.post('/auth/login').send({ email: 'mgr_scope@test.com', password: 'Password123!' });
    });

    afterAll(async () => {
        await disconnectTestDb();
    });

    it('Manager A must not see contract from branch B only', async () => {
        const res = await mgrAgent.get('/admin/contracts/list');
        expect(res.status).toBe(200);
        expect(res.text).not.toContain('SCOPE-B-001');
    });

    it('Manager A cannot open detail of branch B contract', async () => {
        const res = await mgrAgent.get(`/admin/contracts/detail/${contractBOnly._id}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/admin/contracts/list');
    });

    it('CEO can access admin dashboard', async () => {
        await User.create({
            name: 'CEO Scope',
            role: 'CEO',
            email: 'ceo_scope@test.com',
            emailHash: hash('ceo_scope@test.com'),
            password: 'Password123!',
            status: 'Active'
        });
        const ceoAgent = request.agent(app);
        await ceoAgent.post('/auth/login').send({ email: 'ceo_scope@test.com', password: 'Password123!' });
        const res = await ceoAgent.get('/admin');
        expect(res.status).toBe(200);
    });
});
