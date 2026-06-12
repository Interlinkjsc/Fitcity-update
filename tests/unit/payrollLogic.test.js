/**
 * Unit Tests for Payroll Calculation Logic
 */
const payrollService = require('../../src/modules/finance/services/payrollService.js');
const User = require('../../src/modules/users/models/userModel.js');

describe('Payroll Logic Internal Calculation', () => {
    
    it('Should calculate PT commission correctly from sessions (100k tier)', () => {
        const mockSessions = [
            { status: 'Completed' },
            { status: 'Completed' },
            { status: 'Scheduled' }, // Should be ignored
            { status: 'Cancelled' }  // Should be ignored
        ];
        // rate is ignored in new tiered logic, handled by session count: 2 sessions * 100,000 = 200,000
        const result = payrollService.calculatePTCommission(mockSessions);
        expect(result).toBe(200000); 
    });

    it('Should calculate Sales commission from contract revenue', () => {
        const mockContracts = [
            { totalAmount: 10000000, netAmount: 10000000 }, // 10M
            { totalAmount: 20000000, netAmount: 20000000 }, // 20M
            { totalAmount: 5000000, netAmount: 5000000 }   // 5M
        ];
        const rate = 5; // 5%
        const result = payrollService.calculateSalesCommission(mockContracts, rate);
        expect(result).toBe(1750000); // 35M * 0.05 = 1,750,000
    });

    it('Should calculate total salary with bonus and deductions', () => {
        const base = 5000000;
        const comm = 2000000;
        const bonus = 500000;
        const deduct = 300000;
        const total = payrollService.calculateTotalSalary(base, comm, bonus, deduct);
        expect(total).toBe(7200000); // 5+2+0.5 - 0.3 = 7.2
    });

    it('Should not return negative salary', () => {
        const total = payrollService.calculateTotalSalary(1000, 0, 0, 5000);
        expect(total).toBe(0);
    });
});
