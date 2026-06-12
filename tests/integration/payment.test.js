const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const PaymentTransaction = require('../../src/modules/contracts/models/transactionModel.js');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('Payment & Preview Integration', () => {

    let adminCookie, clientCookie;
    let mockClient, mockPackage, mockBranch, mockSales, mockPt;
    let testContract;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const { hash } = require('../../src/utils/encryption');
        // Clean old test data
        await PaymentTransaction.deleteMany({});
        await Contract.deleteMany({ notes: 'PAYMENT_TEST' });
        await ServicePackage.deleteMany({ name: /^TEST_PKG_PAY_/ });
        await Branch.deleteMany({ name: /^TEST_BR_PAY_/ });
        await User.deleteMany({
            emailHash: {
                $in: [
                    hash('client@testpay.com'),
                    hash('sales@testpay.com'),
                    hash('pt@testpay.com'),
                    hash('admin@testpay.com')
                ]
            }
        });

        mockBranch = await Branch.create({ name: 'TEST_BR_PAY_1', address: '456 DEF', phone: '0909876543' });

        mockClient = await User.create({ name: 'Client Pay', email: 'client@testpay.com', password: 'password123', role: 'Client', status: 'Active', branch: mockBranch._id });
        mockSales = await User.create({ name: 'Sales Pay', email: 'sales@testpay.com', password: 'password123', role: 'Sales', status: 'Active', branch: mockBranch._id });
        mockPt = await User.create({ name: 'PT Pay', email: 'pt@testpay.com', password: 'password123', role: 'PT', status: 'Active', branch: mockBranch._id });
        await User.create({ name: 'Admin Pay', email: 'admin@testpay.com', password: 'password123', role: 'Admin', status: 'Active' });

        mockPackage = await ServicePackage.create({ name: 'TEST_PKG_PAY_1', type: 'Gym', price: 10000000, duration: 60, maxSessions: 20, description: 'PT package for pay test' });

        // Create a test contract (Unpaid, with known totalAmount)
        testContract = await Contract.create({
            client: mockClient._id,
            servicePackage: mockPackage._id,
            branch: mockBranch._id,
            sales: mockSales._id,
            pt: mockPt._id,
            totalAmount: 11000000, // 10M + 10% VAT
            basePrice: 10000000,
            discount: 0,
            netAmount: 10000000,
            vat: 10,
            paidAmount: 0,
            paymentStatus: 'Unpaid',
            contractStatus: 'Draft',
            packageSnapshot: {
                name: 'Gói Test Payment',
                price: 10000000,
                duration: 60
            },
            totalSessions: 20,
            remainingSessions: 20,
            endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            notes: 'PAYMENT_TEST'
        });

        // Authenticate as Admin
        const adminRes = await request(app).post('/auth/login').send({ email: 'admin@testpay.com', password: 'password123' });
        adminCookie = adminRes.headers['set-cookie'];

        // Authenticate as Client
        const clientRes = await request(app).post('/auth/login').send({ email: 'client@testpay.com', password: 'password123' });
        clientCookie = clientRes.headers['set-cookie'];
    });

    afterAll(async () => {
        const { hash } = require('../../src/utils/encryption');
        await PaymentTransaction.deleteMany({});
        await Contract.deleteMany({ notes: 'PAYMENT_TEST' });
        await ServicePackage.deleteMany({ name: /^TEST_PKG_PAY_/ });
        await Branch.deleteMany({ name: /^TEST_BR_PAY_/ });
        await User.deleteMany({
            emailHash: {
                $in: [
                    hash('client@testpay.com'),
                    hash('sales@testpay.com'),
                    hash('pt@testpay.com'),
                    hash('admin@testpay.com')
                ]
            }
        });
        await mongoose.connection.close();
    });

    // ===================== ADMIN: POST Payment =====================
    describe('POST /admin/contracts/:id/payments/store', () => {
        it('Should create a Deposit payment and update contract', async () => {
            const res = await request(app)
                .post(`/admin/contracts/${testContract._id}/payments/store`)
                .set('Cookie', adminCookie)
                .send({
                    amount: 3000000,
                    transactionType: 'Deposit',
                    paymentMethod: 'Cash',
                    notes: 'Đặt cọc lần 1'
                });

            expect(res.statusCode).toBe(302);
            expect(res.header.location).toContain(`/admin/contracts/detail/${testContract._id}`);

            // Verify in DB
            const contract = await Contract.findById(testContract._id);
            expect(contract.paidAmount).toBe(3000000);
            expect(contract.paymentStatus).toBe('Deposit');

            const txns = await PaymentTransaction.find({ contractId: testContract._id });
            expect(txns).toHaveLength(1);
            expect(txns[0].receiptNumber).toMatch(/^RCP-/);
            expect(txns[0].transactionType).toBe('Deposit');
        });

        it('Should create a second Installment payment', async () => {
            const res = await request(app)
                .post(`/admin/contracts/${testContract._id}/payments/store`)
                .set('Cookie', adminCookie)
                .send({
                    amount: 5000000,
                    transactionType: 'Installment',
                    paymentMethod: 'Transfer'
                });

            expect(res.statusCode).toBe(302);

            const contract = await Contract.findById(testContract._id);
            expect(contract.paidAmount).toBe(8000000); // 3M + 5M
            expect(contract.paymentStatus).toBe('Deposit'); // Still not fully paid
            expect(contract.paymentMethods).toContain('Cash');
            expect(contract.paymentMethods).toContain('Transfer');
        });

        it('Should mark as Paid when final Balance_Payment clears the debt', async () => {
            const res = await request(app)
                .post(`/admin/contracts/${testContract._id}/payments/store`)
                .set('Cookie', adminCookie)
                .send({
                    amount: 3000000, // 11M - 8M = 3M remaining
                    transactionType: 'Balance_Payment',
                    paymentMethod: 'Card'
                });

            expect(res.statusCode).toBe(302);

            const contract = await Contract.findById(testContract._id);
            expect(contract.paidAmount).toBe(11000000);
            expect(contract.paymentStatus).toBe('Paid');
            expect(contract.contractStatus).toBe('Active');

            const txns = await PaymentTransaction.find({ contractId: testContract._id });
            expect(txns).toHaveLength(3); // Deposit + Installment + Balance
        });

        it('Should reject payment that exceeds remaining debt', async () => {
            const res = await request(app)
                .post(`/admin/contracts/${testContract._id}/payments/store`)
                .set('Cookie', adminCookie)
                .send({
                    amount: 1000,
                    transactionType: 'Installment',
                    paymentMethod: 'Cash'
                });

            // Should redirect with error flash (because 0 debt remaining)
            expect(res.statusCode).toBe(302);

            // Transaction count should remain 3
            const txns = await PaymentTransaction.find({ contractId: testContract._id });
            expect(txns).toHaveLength(3);
        });
    });

    // ===================== ADMIN: Preview Contract =====================
    describe('GET /admin/contracts/:id/preview/contract', () => {
        it('Should render contract preview HTML (no admin layout)', async () => {
            const res = await request(app)
                .get(`/admin/contracts/${testContract._id}/preview/contract`)
                .set('Cookie', adminCookie);

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('HỢP ĐỒNG&#160;TẬP LUYỆN');
            expect(res.text).toContain('FITCITY');
            expect(res.text).toContain('Client Pay');
        });
    });

    // ===================== ADMIN: Preview Receipt =====================
    describe('GET /admin/contracts/:id/preview/receipt/:transactionId', () => {
        it('Should render receipt preview for a specific transaction', async () => {
            const txn = await PaymentTransaction.findOne({ contractId: testContract._id });

            const res = await request(app)
                .get(`/admin/contracts/${testContract._id}/preview/receipt/${txn._id}`)
                .set('Cookie', adminCookie);

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('PHIẾU THU');
            expect(res.text).toContain(txn.receiptNumber);
        });
    });

    // ===================== CLIENT: View Contracts =====================
    describe('GET /client/contracts', () => {
        it('Should render contract list for the logged-in client', async () => {
            const res = await request(app)
                .get('/client/contracts')
                .set('Cookie', clientCookie);

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('HỢP ĐỒNG');
            expect(res.text).toContain('Gói Test Payment');
        });
    });

    // ===================== CLIENT: Preview Contract =====================
    describe('GET /client/contracts/:id/preview', () => {
        it('Should render contract preview for the client\'s own contract', async () => {
            const res = await request(app)
                .get(`/client/contracts/${testContract._id}/preview`)
                .set('Cookie', clientCookie);

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('HỢP ĐỒNG&#160;TẬP LUYỆN');
            expect(res.text).toContain('Client Pay');
        });
    });

    // ===================== CLIENT: Preview Receipt =====================
    describe('GET /client/contracts/:id/receipt/:transactionId', () => {
        it('Should render receipt preview for the client\'s own transaction', async () => {
            const txn = await PaymentTransaction.findOne({ contractId: testContract._id });

            const res = await request(app)
                .get(`/client/contracts/${testContract._id}/receipt/${txn._id}`)
                .set('Cookie', clientCookie);

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('PHIẾU THU');
        });
    });
});
