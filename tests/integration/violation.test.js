const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const Violation = require('../../src/modules/crm/models/violationModel.js');
const Payroll = require('../../src/modules/finance/models/payrollModel.js');
const session = require('supertest-session');

describe('Violation to Payroll Workflow (E2E)', () => {
    let testSession;
    let adminUser;
    let ptUser;
    let testBranch;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Clear collections
        await User.deleteMany({ name: { $in: ['Admin Tester', 'PT Tester'] } });
        await Violation.deleteMany({});
        await Payroll.deleteMany({});
        await Branch.deleteMany({ name: 'Dummy Branch for Violations' });

        testBranch = await Branch.create({
            name: 'Dummy Branch for Violations',
            address: '123 Test St',
            phone: '0123456789'
        });

        // Create Admin
        adminUser = await User.create({
            name: 'Admin Tester',
            email: 'admin_violation@test.com',
            password: 'password123',
            role: 'Admin',
            status: 'Active'
        });

        // Create PT
        ptUser = await User.create({
            name: 'PT Tester',
            email: 'pt_violation@test.com',
            password: 'password123',
            role: 'PT',
            branch: testBranch._id,
            status: 'Active',
            baseSalary: 10000000 // 10 million base salary
        });

        testSession = session(app);

        // Login Admin
        await testSession.post('/auth/login').send({
            email: 'admin_violation@test.com',
            password: 'password123'
        });
    });

    afterAll(async () => {
        await User.deleteMany({ name: { $in: ['Admin Tester', 'PT Tester'] } });
        if (ptUser) {
            await Violation.deleteMany({ staff: ptUser._id });
            await Payroll.deleteMany({ staff: ptUser._id });
        }
        await Branch.deleteMany({ name: 'Dummy Branch for Violations' });
        await mongoose.disconnect();
    });

    it('Admin should be able to create a violation for PT', async () => {
        const res = await testSession.post('/admin/violations/store')
            .send({
                staff: ptUser._id.toString(),
                type: 'Đi trễ',
                description: 'Trễ 15 phút ca sáng',
                penaltyAmount: 200000,
                date: new Date().toISOString().split('T')[0]
            });

        expect(res.status).toBe(302); // Redirect back to list
        expect(res.headers.location).toBe('/admin/violations');

        const violationInDb = await Violation.findOne({ staff: ptUser._id });
        expect(violationInDb).toBeDefined();
        expect(violationInDb.penaltyAmount).toBe(200000);
        expect(violationInDb.status).toBe('Pending');
    });

    it('Auto Suggest Payroll should deduct the violation penalty from the PT salary', async () => {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Admin triggers Auto Suggest Payroll
        const res = await testSession.post('/admin/payroll/auto-suggest')
            .send({
                month: currentMonth,
                year: currentYear
            });

        expect(res.status).toBe(302); // Redirect back to payroll

        // Check if payrolls are created
        const payrolls = await Payroll.find({ staff: ptUser._id, month: currentMonth, year: currentYear });
        expect(payrolls.length).toBe(2);

        // Deductions should be divided by 2 (100000 per period)
        expect(payrolls[0].deductions).toBe(100000);
        expect(payrolls[1].deductions).toBe(100000);

        // Total salary check
        const halfBase = 5000000;
        expect(payrolls[0].totalSalary).toBe(halfBase - 100000);

        // Check violation status updated
        const violationInDb = await Violation.findOne({ staff: ptUser._id });
        expect(violationInDb.status).toBe('Applied_To_Payroll');
    });
});
