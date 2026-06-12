/**
 * Integration Tests for Payroll Approval Flow
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const Payroll = require('../../src/modules/finance/models/payrollModel.js');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('Payroll Management Integration', () => {
    let admin, pt, branch, servicePackage, contract, adminSession;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const { hash } = require('../../src/utils/encryption');
        // 1. Cleanup
        await User.deleteMany({ 
            emailHash: { 
                $in: [
                    hash('admin_test_payroll@fitcity.com'),
                    hash('pt_test_payroll@fitcity.com')
                ] 
            } 
        });
        await Branch.deleteMany({ name: 'Test Branch Payroll' });
        await ServicePackage.deleteMany({ name: 'Test Pack Payroll' });
        await Payroll.deleteMany({ month, year });

        // 2. Setup Base Data
        branch = await Branch.create({
            name: 'Test Branch Payroll',
            address: '123 Test St',
            phone: '0912121212',
            coordinates: { lat: 0, lng: 0 },
            status: 'Open'
        });

        admin = await User.create({
            name: 'Admin Payroll',
            email: 'admin_test_payroll@fitcity.com',
            password: 'password123',
            role: 'Admin',
            branch: branch._id,
            status: 'Active'
        });

        pt = await User.create({
            name: 'PT Payroll',
            email: 'pt_test_payroll@fitcity.com',
            password: 'password123',
            role: 'PT',
            branch: branch._id,
            baseSalary: 6000000, // Custom salary
            ptCommissionPerSession: 200000, // Custom rate
            status: 'Active'
        });

        servicePackage = await ServicePackage.create({
            name: 'Test Pack Payroll',
            type: 'Gym',
            price: 1000000,
            duration: 30,
            sessions: 0
        });

        // 3. Login as Admin
        const loginRes = await request(app)
            .post('/auth/login')
            .send({ email: 'admin_test_payroll@fitcity.com', password: 'password123' });
        
        adminSession = loginRes.headers['set-cookie'];
    });

    afterAll(async () => {
        const { hash } = require('../../src/utils/encryption');
        await User.deleteMany({ 
            emailHash: { 
                $in: [
                    hash('admin_test_payroll@fitcity.com'),
                    hash('pt_test_payroll@fitcity.com')
                ] 
            } 
        });
        await Branch.deleteMany({ name: 'Test Branch Payroll' });
        await ServicePackage.deleteMany({ name: 'Test Pack Payroll' });
        await Payroll.deleteMany({ month, year });
        await mongoose.connection.close();
    });

    it('Should fetch payroll summary table', async () => {
        const res = await request(app)
            .get('/admin/payroll/summary')
            .set('Cookie', adminSession);
        
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Thanh toán Lương');
        expect(res.text).toContain('PT Payroll');
    });

    it('Should successfully approve payroll for a staff member', async () => {
        const res = await request(app)
            .post('/admin/payroll/approve')
            .set('Cookie', adminSession)
            .send({
                staffId: pt._id,
                month,
                year,
                commission: 400000, // Manual/calculated comm
                totalSalary: 6400000 // 6M base + 400k comm
            });
        
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe(`/admin/payroll?month=${month}&year=${year}`);

        // Verify in DB - Find period 1
        const savedPayroll = await Payroll.findOne({ staff: pt._id, month, year, period: 1 });
        expect(savedPayroll).toBeDefined();
        expect(savedPayroll.status).toBe('Pending');
        expect(savedPayroll.baseSalary).toBe(3000000); // 6M / 2
        expect(savedPayroll.totalSalary).toBe(3200000); // (6M + 400k) / 2
    });

    it('Should NOT allow editing if payroll is already PAID', async () => {
        // Mock state to PAID for period 1
        await Payroll.findOneAndUpdate({ staff: pt._id, month, year, period: 1 }, { status: 'Paid' });

        const res = await request(app)
            .post('/admin/payroll/approve')
            .set('Cookie', adminSession)
            .send({
                staffId: pt._id,
                month,
                year,
                commission: 500000,
                totalSalary: 6500000
            });
        
        expect(res.statusCode).toBe(302);
        
        // Final state should still be Paid, not Approved again with new value
        const verifyPayroll = await Payroll.findOne({ staff: pt._id, month, year, period: 1 });
        expect(verifyPayroll.status).toBe('Paid');
        expect(verifyPayroll.totalSalary).toBe(3200000); // Old value preserved
    });
});
