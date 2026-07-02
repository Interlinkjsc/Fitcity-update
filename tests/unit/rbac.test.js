const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const { hash } = require('../../src/utils/encryption');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.setTimeout(60000);

describe('FITCITY DEEP RBAC & SECURITY ANALYSIS - ZERO TRUST POLICY', () => {
    let agents = {};
    let branchA, branchB, ptA, ptB, clientA, clientB, contractA;
    let mongoServer;

    beforeAll(async () => {
        // Khởi tạo DB Test trong bộ nhớ
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.disconnect(); // Đảm bảo ngắt các kết nối cũ
        await mongoose.connect(mongoUri);

        // 1. Tạo 2 chi nhánh để test Branch Isolation
        branchA = await Branch.create({ name: 'FitCity District 1', address: 'D1', phone: '0901234567' });
        branchB = await Branch.create({ name: 'FitCity District 7', address: 'D7', phone: '0907654321' });

        // 2. Tạo tập hợp Users phong phú
        const usersToCreate = [
            { role: 'SA', email: 'sa@fitcity.com' },
            { role: 'CEO', email: 'ceo@fitcity.com' },
            { role: 'Accountant', email: 'acc@fitcity.com', branch: branchA._id },
            { role: 'Marketing', email: 'mkt@fitcity.com', branch: branchA._id },
            { role: 'Manager', email: 'mgr_a@fitcity.com', branch: branchA._id },
            { role: 'Manager', email: 'mgr_b@fitcity.com', branch: branchB._id },
            { role: 'PT', email: 'pt_a@fitcity.com', branch: branchA._id },
            { role: 'PT', email: 'pt_b@fitcity.com', branch: branchB._id },
            { role: 'Client', email: 'cli_a@fitcity.com', branch: branchA._id },
            { role: 'Client', email: 'cli_b@fitcity.com', branch: branchB._id }
        ];

        for (const u of usersToCreate) {
            const user = await User.create({
                name: `${u.role} User`,
                role: u.role,
                email: u.email,
                emailHash: hash(u.email),
                password: 'Password123!',
                branch: u.branch || null,
                status: 'Active'
            });
            if (u.email === 'pt_a@fitcity.com') ptA = user;
            if (u.email === 'pt_b@fitcity.com') ptB = user;
            if (u.email === 'cli_a@fitcity.com') clientA = user;
            if (u.email === 'cli_b@fitcity.com') clientB = user;

            const agent = request.agent(app);
            await agent.post('/auth/login').send({ email: u.email, password: 'Password123!' });
            agents[u.email] = agent;
        }

        // 3. Tạo dữ liệu mẫu
        contractA = await Contract.create({
            client: clientA._id,
            pt: ptA._id,
            sales: ptA._id, // Giả định PT cũng là Sales cho gọn
            branch: branchA._id,
            servicePackage: new mongoose.Types.ObjectId(),
            basePrice: 10000000,
            netAmount: 10000000,
            totalAmount: 10000000,
            discount: 0,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            contractStatus: 'Active',
            packageSnapshot: {
                name: 'Gói Test RBAC',
                price: 10000000,
                duration: 30
            }
        });
    });

    /**
     * TEST: BRANCH ISOLATION (QUAN TRỌNG NHẤT CHO ERP)
     */
    describe('Security: Branch Data Isolation', () => {
        test('Manager A MUST NOT access Dashboard of Branch B', async () => {
            const res = await agents['mgr_a@fitcity.com'].get(`/admin/users/dashboard/branch/${branchB._id}`);
            expect(res.status).toBe(403);
        });

        test('PT A MUST NOT create contract for Client B (Cross-branch violation)', async () => {
            const res = await agents['pt_a@fitcity.com']
                .post('/pt/contracts/store')
                .set('Accept', 'application/json')
                .send({
                    client: clientB._id,
                    totalPrice: 5000000,
                    branchId: branchB._id
                });
            expect(res.status).toBe(403);
        });

        test('Manager A should only see Staff of Branch A in list', async () => {
            const res = await agents['mgr_a@fitcity.com'].get('/admin/users/list');
            // Kiểm tra body data (Giả sử controller trả về JSON hoặc render có filter)
            // Nếu là render EJS, ta check nội dung text không chứa "pt_b@fitcity.com"
            expect(res.text).not.toContain('pt_b@fitcity.com');
            expect(res.text).toContain('pt_a@fitcity.com');
        });
    });

    /**
     * TEST: FIELD-LEVEL SECURITY & DATA PRIVACY
     */
    describe('Security: Field-Level & Ownership Privacy', () => {
        test('Client A MUST NOT view Meal Plan of Client B', async () => {
            // Giả sử có một Meal Plan ID của Client B
            const otherMealPlanId = 'someone_else_plan_id';
            const res = await agents['cli_a@fitcity.com'].get(`/pt/meal-plans/${otherMealPlanId}`);
            expect(res.status).toBe(403);
        });

        test('PT viewing contract SHOULD NOT see Financial Tax Documents (Accountant only)', async () => {
            const res = await agents['pt_a@fitcity.com'].get(`/admin/contracts/${contractA._id}`);
            // PT vẫn xem được info cơ bản, nhưng không được thấy link/data về Tax
            expect(res.text).not.toContain('tax-invoice-link');
        });
    });

    /**
     * TEST: STATE TRANSITION INTEGRITY (SRS OPERATION)
     */
    describe('Operation: Session State Machine Integrity', () => {
        test('PT cannot force COMPLETE a session without Client Confirmation', async () => {
            const res = await agents['pt_a@fitcity.com'].post('/pt/sessions/complete').send({
                sessionId: new mongoose.Types.ObjectId()
            });
            // Lỗi vì chưa có Confirm từ Client
            expect(res.status).toBe(400); 
        });
    });

    /**
     * TEST: ADMINISTRATIVE POWER LIMITS
     */
    describe('Security: CEO vs Accountant vs SA', () => {
        test('Accountant cannot change System VAT rate (CEO only)', async () => {
            const res = await agents['acc@fitcity.com'].post('/admin/users/settings/vat').send({ rate: 15 });
            expect(res.status).toBe(403);
        });

        test('SA/Admin can manage JD (Job Description), CEO cannot', async () => {
            const res = await agents['ceo@fitcity.com']
                .get('/admin/users/settings/jd')
                .set('Accept', 'application/json');
            expect(res.status).toBe(403);
        });
    });

    afterAll(async () => {
        await User.deleteMany({});
        await Branch.deleteMany({});
        await Contract.deleteMany({});
        await mongoose.disconnect();
        await mongoServer.stop();
    });
});
