const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const EmployeeKPITarget = require('../../src/modules/programs/models/employeeKpiTargetModel.js');
const { hash } = require('../../src/utils/encryption');
const { connectTestDb, disconnectTestDb } = require('../helpers/testDb');
const kpiService = require('../../src/modules/platform/services/kpiService');

jest.setTimeout(60000);

describe('Employee KPI target', () => {
    let branch;
    let sales;
    let adminAgent;

    beforeAll(async () => {
        await connectTestDb();

        branch = await Branch.create({ name: 'KPI Emp Branch', address: 'X', phone: '0903333333' });
        sales = await User.create({
            name: 'Sales KPI Emp',
            role: 'Sales',
            email: 'sales_kpi_emp@test.com',
            emailHash: hash('sales_kpi_emp@test.com'),
            password: 'Password123!',
            branch: branch._id,
            status: 'Active'
        });
        const admin = await User.create({
            name: 'Admin KPI',
            role: 'Admin',
            email: 'admin_kpi_emp@test.com',
            emailHash: hash('admin_kpi_emp@test.com'),
            password: 'Password123!',
            status: 'Active'
        });

        adminAgent = request.agent(app);
        await adminAgent.post('/auth/login').send({ email: 'admin_kpi_emp@test.com', password: 'Password123!' });
    });

    afterAll(async () => {
        await disconnectTestDb();
    });

    it('saveEmployeeKPITarget persists kpiMonth/kpiYear from form body', async () => {
        const month = 6;
        const year = 2026;
        await kpiService.saveEmployeeKPITarget(
            sales._id,
            {
                kpiMonth: month,
                kpiYear: year,
                revenueTarget: 50_000_000,
                contractTarget: 5,
                newLeadTarget: 20
            },
            new mongoose.Types.ObjectId()
        );

        const row = await EmployeeKPITarget.findOne({ staff: sales._id, month, year }).lean();
        expect(row).toMatchObject({
            revenueTarget: 50_000_000,
            contractTarget: 5,
            newLeadTarget: 20
        });
    });

    it('employee target overrides branch in getSalesKPI', async () => {
        const KPIConfig = require('../../src/modules/programs/models/kpiModel');
        await KPIConfig.create({
            branch: branch._id,
            month: 6,
            year: 2026,
            revenueTarget: 100_000_000,
            contractTarget: 10,
            newLeadTarget: 50
        });

        const kpi = await kpiService.getSalesKPI(sales, 6, 2026);
        expect(kpi.targetSource).toBe('employee');
        expect(kpi.contractTarget).toBe(5);
        expect(kpi.newLeadTarget).toBe(20);
        expect(kpi.revenueTarget).toBe(50_000_000);
    });

    it('POST /admin/users/detail/:id/kpi-target redirects with success', async () => {
        const res = await adminAgent
            .post(`/admin/users/detail/${sales._id}/kpi-target`)
            .type('form')
            .send({
                kpiMonth: 7,
                kpiYear: 2026,
                revenueTarget: 60_000_000,
                contractTarget: 6,
                newLeadTarget: 25
            });

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain(`kpiMonth=7&kpiYear=2026`);

        const row = await EmployeeKPITarget.findOne({ staff: sales._id, month: 7, year: 2026 }).lean();
        expect(row.contractTarget).toBe(6);
    });
});
