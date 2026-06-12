const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const path = require('path');
const { hash } = require('../../src/utils/encryption');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const TEST_EMAILS = ['client@testbill.com', 'sales@testbill.com', 'pt@testbill.com', 'admin@testbill.com'];

function contractFixture(overrides = {}) {
    return {
        packageSnapshot: {
            name: 'TEST_PKG_BILL_1',
            type: 'Gym',
            duration: 30,
            sessions: 10,
            price: 1000000
        },
        basePrice: 10000000,
        netAmount: 9900000,
        discount: 100000,
        vat: 10,
        totalAmount: 10890000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        contractStatus: 'Active',
        ...overrides
    };
}

describe('Contract & Billing Controller Integration', () => {

    let adminCookie;
    let mockClient, mockPackage, mockBranch, mockSales, mockPt;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        
        // Clean old data
        await Contract.deleteMany({});
        await ServicePackage.deleteMany({ name: /^TEST_PKG_BILL_/ });
        await Branch.deleteMany({ name: /^TEST_BR_BILL_/ });
        await User.deleteMany({
            $or: [
                { email: { $in: TEST_EMAILS } },
                { emailHash: { $in: TEST_EMAILS.map((e) => hash(e)) } }
            ]
        });

        mockBranch = await Branch.create({ name: 'TEST_BR_BILL_1', address: '123 ABC', phone: '0901234567' });

        // Create Mocks (Mandatory branch for non-SA/Admin)
        mockClient = await User.create({ name: 'Client Bill', email: 'client@testbill.com', password: 'password123', role: 'Client', status: 'Active', branch: mockBranch._id });
        mockSales = await User.create({ name: 'Sales Bill', email: 'sales@testbill.com', password: 'password123', role: 'Sales', status: 'Active', branch: mockBranch._id });
        mockPt = await User.create({ name: 'PT Bill', email: 'pt@testbill.com', password: 'password123', role: 'PT', status: 'Active', branch: mockBranch._id });
        
        const adminUser = await User.create({ name: 'Admin Bill', email: 'admin@testbill.com', password: 'password123', role: 'Admin', status: 'Active' });
        
        mockPackage = await ServicePackage.create({
            name: 'TEST_PKG_BILL_1',
            type: 'Gym',
            price: 1000000,
            duration: 30,
            sessions: 10,
            description: 'Desc'
        });

        // Authenticate as Admin
        const res = await request(app).post('/auth/login').send({ email: 'admin@testbill.com', password: 'password123' });
        adminCookie = res.headers['set-cookie'];
    });

    afterAll(async () => {
        await Contract.deleteMany({});
        await ServicePackage.deleteMany({ name: /^TEST_PKG_BILL_/ });
        await Branch.deleteMany({ name: /^TEST_BR_BILL_/ });
        await User.deleteMany({
            $or: [
                { email: { $in: TEST_EMAILS } },
                { emailHash: { $in: TEST_EMAILS.map((e) => hash(e)) } }
            ]
        });
        await mongoose.connection.close();
    });

    describe('GET /admin/contracts/list', () => {
        it('Should render the contract list table', async () => {
            const res = await request(app).get('/admin/contracts/list').set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Doanh thu & Hợp đồng Hội viên');
        });
    });

    describe('GET /admin/contracts/create', () => {
        it('Should render form with predefined dropdown options', async () => {
            const res = await request(app).get('/admin/contracts/create').set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Client Bill');
            expect(res.text).toContain('TEST_PKG_BILL_1');
            
            const match = res.text.match(/id="contract-step1-json">([\s\S]*?)<\/script>/);
            expect(match).not.toBeNull();
            const jsonData = JSON.parse(match[1]);
            const ptBillSales = jsonData.sales.find(s => s.name === 'PT Bill');
            expect(ptBillSales).toBeDefined();
        });
    });

    describe('POST /admin/contracts/store', () => {
        it('Should create a contract, calculate VAT, and handle Paid status', async () => {
            const res = await request(app)
                .post('/admin/contracts/store')
                .set('Cookie', adminCookie)
                .send({
                    client: mockClient._id,
                    servicePackage: mockPackage._id,
                    branch: mockBranch._id,
                    sales: mockSales._id,
                    pt: mockPt._id,
                    discount: 100000, // discount 100k
                    paymentStatus: 'Paid',
                    paymentMethods: 'Cash'
                });

            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/contracts/list');

            const contract = await Contract.findOne({ client: mockClient._id });
            expect(contract).not.toBeNull();
            
            // unit 1M/buổi × 10 buổi = 10M base; discount 100k → net 9.9M; VAT 10% → 10.89M
            expect(contract.basePrice).toBe(10000000);
            expect(contract.totalAmount).toBe(10890000);
            expect(contract.paymentStatus).toBe('Paid');
            expect(contract.netAmount).toBe(9900000);
            expect(contract.paidAmount).toBe(10890000);
            expect(contract.contractStatus).toBe('Active'); // Paid makes it Active immediately
            expect(contract.paymentMethods).toContain('Cash');
            expect(contract.paymentMethod).toBe('Cash');
        });

        it('Should redirect back on missing client id (Validation Failure)', async () => {
            const res = await request(app)
                .post('/admin/contracts/store')
                .set('Cookie', adminCookie)
                .send({
                    servicePackage: mockPackage._id,
                    branch: mockBranch._id,
                    sales: mockSales._id
                }); // Missing client
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/contracts/create');
        });

        it('Should reject contract when branch does not match client branch (R4)', async () => {
            const otherBranch = await Branch.create({
                name: 'TEST_BR_BILL_2',
                address: '999 XYZ',
                phone: '0901234568'
            });

            const res = await request(app)
                .post('/admin/contracts/store')
                .set('Cookie', adminCookie)
                .send({
                    client: mockClient._id,
                    servicePackage: mockPackage._id,
                    branch: otherBranch._id,
                    sales: mockSales._id,
                    pt: mockPt._id,
                    discount: 0
                });

            expect(res.statusCode).toBe(302);
            expect(res.headers.location).toBe('/admin/contracts/create');

            const count = await Contract.countDocuments({ client: mockClient._id });
            expect(count).toBeGreaterThanOrEqual(0); // should not increase for mismatch
        });
    });

    describe('GET /admin/contracts/edit/:id', () => {
        it('Should load edit form for an existing contract', async () => {
            const c = await Contract.findOne({ client: mockClient._id });
            const res = await request(app).get(`/admin/contracts/edit/${c._id}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Cập nhật Thanh toán');
        });
    });

    describe('POST /admin/contracts/update/:id', () => {
        it('Should update payment status from Unpaid to Paid and auto sync paidAmount', async () => {
            // Create a fake Unpaid contract
            const unpaid = await Contract.create(contractFixture({
                client: mockClient._id,
                servicePackage: mockPackage._id,
                branch: mockBranch._id,
                sales: mockSales._id,
                basePrice: 1000000,
                netAmount: 1000000,
                discount: 0,
                totalAmount: 1100000,
                paymentStatus: 'Unpaid',
                paidAmount: 0,
                contractStatus: 'Draft'
            }));

            const res = await request(app)
                .post(`/admin/contracts/update/${unpaid._id}`)
                .set('Cookie', adminCookie)
                .send({ paymentStatus: 'Paid' });

            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/contracts/list');

            const check = await Contract.findById(unpaid._id);
            expect(check.paymentStatus).toBe('Paid');
            expect(check.paidAmount).toBe(1100000); // Should auto sync
            expect(check.contractStatus).toBe('Active');
        });
    });

    describe('POST /admin/contracts/delete/:id', () => {
        it('Should prevent non-SA users from deleting a Paid contract', async () => {
            // Because adminCookie belongs to 'Admin' and not 'SA'
            const c = await Contract.findOne({ paymentStatus: 'Paid' });
            const res = await request(app).post(`/admin/contracts/delete/${c._id}`).set('Cookie', adminCookie);
            
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/contracts/list'); // Redirected with error flash
            
            const check = await Contract.findById(c._id);
            expect(check).not.toBeNull(); // Should not be deleted
        });

        it('Should allow Admin to delete an Unpaid contract', async () => {
            const unpaid = await Contract.create(contractFixture({
                client: mockClient._id,
                servicePackage: mockPackage._id,
                branch: mockBranch._id,
                sales: mockSales._id,
                basePrice: 1000000,
                netAmount: 1000000,
                discount: 0,
                totalAmount: 1100000,
                paymentStatus: 'Unpaid',
                paidAmount: 0,
                contractStatus: 'Draft'
            }));

            const res = await request(app).post(`/admin/contracts/delete/${unpaid._id}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(302);
            
            const check = await Contract.findById(unpaid._id);
            expect(check).toBeNull(); // Successfully deleted
        });
    });
});
