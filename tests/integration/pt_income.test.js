const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const Payroll = require('../../src/modules/finance/models/payrollModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('PT Income View Integration', () => {
    let ptCookie;
    let branchId;
    let ptUser;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const { hash } = require('../../src/utils/encryption');
        await User.deleteMany({ emailHash: { $in: [hash('pt_income_test@fitcity.com')] } });
        await Branch.deleteMany({ name: 'Branch_PT_INCOME' });
        await Payroll.deleteMany({ note: /PT_INCOME_TEST/ });

        const branch = await Branch.create({
            name: 'Branch_PT_INCOME',
            address: 'Test address',
            phone: '0900000001',
            status: 'Open'
        });
        branchId = branch._id;

        ptUser = await User.create({
            name: 'PT Income',
            email: 'pt_income_test@fitcity.com',
            password: 'password123',
            role: 'PT',
            status: 'Active',
            branch: branchId,
            baseSalary: 6000000
        });

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        await Payroll.create({
            staff: ptUser._id,
            month,
            year,
            period: 1,
            baseSalary: 3000000,
            commission: 500000,
            bonus: 0,
            deductions: 100000,
            totalSalary: 3400000,
            status: 'Pending',
            suggestedPayDate: new Date(year, month - 1, 5),
            note: 'PT_INCOME_TEST_PERIOD_1'
        });

        const loginRes = await request(app)
            .post('/auth/login')
            .send({ email: 'pt_income_test@fitcity.com', password: 'password123' });
        ptCookie = loginRes.headers['set-cookie'];
    });

    afterAll(async () => {
        const { hash } = require('../../src/utils/encryption');
        await Payroll.deleteMany({ note: /PT_INCOME_TEST/ });
        await User.deleteMany({ emailHash: { $in: [hash('pt_income_test@fitcity.com')] } });
        await Branch.deleteMany({ _id: branchId });
        await mongoose.disconnect();
    });

    it('GET /pt/income should render income page for PT', async () => {
        const res = await request(app)
            .get('/pt/income')
            .set('Cookie', ptCookie);

        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Thu nhập');
        expect(res.text).toContain('PT_INCOME_TEST_PERIOD_1');
    });
});

