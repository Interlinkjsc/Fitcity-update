const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const User = require('../../src/modules/users/models/userModel.js');
const PTChangeRequest = require('../../src/modules/pt/models/ptChangeRequestModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');

jest.setTimeout(30000);

describe('PT Change Request Integration Test', () => {
    let client, pt, pt2, manager, agent, branch;

    beforeAll(async () => {
        // Connect to test DB
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        // Create a branch
        branch = await Branch.create({
            name: 'Test Branch',
            address: '123 Test St',
            phone: '0987654321',
            status: 'Open'
        });

        // Setup mock users
        client = await User.create({
            name: 'Test Client',
            email: 'client@test.com',
            password: 'password123',
            role: 'Client',
            status: 'Active',
            branch: branch._id
        });

        pt = await User.create({
            name: 'Test PT 1',
            email: 'pt1@test.com',
            password: 'password123',
            role: 'PT',
            status: 'Active',
            branch: branch._id
        });

        pt2 = await User.create({
            name: 'Test PT 2',
            email: 'pt2@test.com',
            password: 'password123',
            role: 'PT',
            status: 'Active',
            branch: branch._id
        });

        manager = await User.create({
            name: 'Test Manager',
            email: 'manager@test.com',
            password: 'password123',
            role: 'Manager',
            status: 'Active',
            branch: branch._id
        });

        agent = request.agent(app);
    });

    afterAll(async () => {
        try {
            await User.deleteMany({});
            await PTChangeRequest.deleteMany({});
            await Branch.deleteMany({});
            await Contract.deleteMany({});
            if (mongoose.connection.readyState !== 0) {
                await mongoose.connection.close();
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    it('should allow a client to submit a PT change request', async () => {
        // Create an active contract for the client
        await Contract.create({
            client: client._id,
            servicePackage: new mongoose.Types.ObjectId(), // Mock ID
            branch: branch._id,
            sales: manager._id,
            pt: pt._id,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            basePrice: 1000000,
            netAmount: 1000000,
            totalAmount: 1000000,
            contractStatus: 'Active',
            packageSnapshot: {
                name: 'Gói Test PT Change',
                price: 1000000,
                duration: 30
            }
        });

        // Login as client
        await agent.post('/auth/login').send({ email: 'client@test.com', password: 'password123' });

        const res = await agent.post('/client/pt-change-request').send({
            currentPTId: pt._id,
            reason: 'I want a different training style.'
        });

        expect(res.status).toBe(302); 
        
        const ptRequest = await PTChangeRequest.findOne({ client: client._id });
        expect(ptRequest).toBeDefined();
        expect(ptRequest.reason).toBe('I want a different training style.');
        expect(ptRequest.status).toBe('Pending');
    });

    it('should allow a manager to approve a PT change request and reassign PT', async () => {
        // Login as manager
        await agent.post('/auth/login').send({ email: 'manager@test.com', password: 'password123' });

        const ptRequest = await PTChangeRequest.findOne({ client: client._id });

        const res = await agent.post(`/admin/pt-change-requests/${ptRequest._id}/update`).send({
            status: 'Approved',
            adminNote: 'Accepted. Assigning PT 2.',
            newPTId: pt2._id.toString()
        });

        expect(res.status).toBe(302); 
        
        const updatedRequest = await PTChangeRequest.findById(ptRequest._id);
        expect(updatedRequest.status).toBe('Approved');
        expect(updatedRequest.processedBy.toString()).toBe(manager._id.toString());

        // Verify contract update
        const updatedContract = await Contract.findOne({ client: client._id, contractStatus: 'Active' });
        expect(updatedContract.pt.toString()).toBe(pt2._id.toString());
    });
});
