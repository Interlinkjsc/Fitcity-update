const payrollService = require('../../src/modules/finance/services/payrollService.js');

describe('Payroll Service - Full Coverage', () => {
    describe('calculatePTCommission', () => {
        it('Should calculate correctly: 10 completed * 100k = 1,000,000', () => {
            const sessions = Array(10).fill({ status: 'Completed' });
            expect(payrollService.calculatePTCommission(sessions)).toBe(1000000); // Tier 1: 100k
        });

        it('Should calculate correctly: 25 completed * 120k = 3,000,000', () => {
            const sessions = Array(25).fill({ status: 'Completed' });
            expect(payrollService.calculatePTCommission(sessions)).toBe(3000000); // Tier 2: 120k
        });

        it('Should calculate correctly: 55 completed * 150k = 8,250,000', () => {
            const sessions = Array(55).fill({ status: 'Completed' });
            expect(payrollService.calculatePTCommission(sessions)).toBe(8250000); // Tier 3: 150k
        });

        it('Should return 0 for empty sessions array', () => {
            expect(payrollService.calculatePTCommission([])).toBe(0);
        });

        it('Should return 0 when called with defaults (no args)', () => {
            expect(payrollService.calculatePTCommission()).toBe(0);
        });
    });

    describe('calculateSalesCommission', () => {
        it('Should calculate 100M netAmount * 5% = 5,000,000', () => {
            const contracts = [{ netAmount: 50000000 }, { netAmount: 50000000 }];
            expect(payrollService.calculateSalesCommission(contracts, 5)).toBe(5000000);
        });

        it('Should return 0 for empty contracts', () => {
            expect(payrollService.calculateSalesCommission([], 5)).toBe(0);
        });

        it('Should return 0 when called with defaults (no args)', () => {
            expect(payrollService.calculateSalesCommission()).toBe(0);
        });

        it('Should fallback to basePrice - discount when netAmount missing', () => {
            const contracts = [{ basePrice: 2000000, discount: 500000 }, {}];
            expect(payrollService.calculateSalesCommission(contracts, 10)).toBe(150000);
        });
    });

    describe('calculatePTCommissionFromContracts', () => {
        it('sums ptCommission on paid contracts', () => {
            const contracts = [{ ptCommission: 1000000 }, { ptCommission: 500000 }];
            expect(payrollService.calculatePTCommissionFromContracts(contracts)).toBe(1500000);
        });
    });

    describe('calculatePTCommissionFromTimesheets', () => {
        it('multiplies approved shifts by rate', async () => {
            const timesheetService = require('../../src/modules/pt/services/timesheetService.js');
            jest.spyOn(timesheetService, 'countApprovedShifts').mockResolvedValue(4);
            const total = await payrollService.calculatePTCommissionFromTimesheets(
                'staff1',
                5,
                2026,
                125000
            );
            expect(total).toBe(500000);
            timesheetService.countApprovedShifts.mockRestore();
        });
    });

    describe('calculateTotalSalary', () => {
        it('Should calculate base + commission + bonus - deductions', () => {
            expect(payrollService.calculateTotalSalary(5000000, 2000000, 500000, 200000)).toBe(7300000);
        });

        it('Should never return negative salary', () => {
            expect(payrollService.calculateTotalSalary(1000000, 0, 0, 5000000)).toBe(0);
        });

        it('Should return 0 when called with defaults (no args)', () => {
            expect(payrollService.calculateTotalSalary()).toBe(0);
        });
    });
});
