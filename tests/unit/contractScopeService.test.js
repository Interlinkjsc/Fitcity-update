const mongoose = require('mongoose');
const {
    buildContractListFilter,
    canAccessContract,
    GLOBAL_VIEW_ROLES
} = require('../../src/modules/contracts/services/contractScopeService');

describe('contractScopeService', () => {
    const branchA = new mongoose.Types.ObjectId();
    const branchB = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const manager = { role: 'Manager', id: userId, branch: branchA };
    const sales = { role: 'Sales', id: userId, branch: branchA };
    const admin = { role: 'Admin', id: userId };

    describe('buildContractListFilter', () => {
        it('Manager sees branch OR own sales/pt contracts', () => {
            const filter = buildContractListFilter(manager, {});
            expect(filter.$or).toBeDefined();
            expect(filter.$or).toEqual(
                expect.arrayContaining([
                    { branch: branchA },
                    { sales: userId },
                    { pt: userId }
                ])
            );
        });

        it('Sales sees only own sales contracts', () => {
            const filter = buildContractListFilter(sales, {});
            expect(filter).toEqual({ sales: userId });
        });

        it('Admin with branchId query filters by branch', () => {
            const filter = buildContractListFilter(admin, { branchId: branchB.toString() });
            expect(filter).toEqual({ branch: branchB });
        });

        it('Manager cannot filter another branch via query', () => {
            const filter = buildContractListFilter(manager, { branchId: branchB.toString() });
            expect(filter.$or).toBeDefined();
            expect(filter.branch).toBeUndefined();
        });
    });

    describe('canAccessContract', () => {
        const contractAtBranch = { branch: branchA, sales: new mongoose.Types.ObjectId(), pt: null };
        const contractAsSales = { branch: branchB, sales: userId, pt: null };

        it('Manager can access contract at own branch', () => {
            expect(canAccessContract(manager, contractAtBranch)).toBe(true);
        });

        it('Manager can access contract where they are sales', () => {
            expect(canAccessContract(manager, contractAsSales)).toBe(true);
        });

        it('Sales cannot access contract of another sales', () => {
            expect(canAccessContract(sales, contractAtBranch)).toBe(false);
        });

        it('Admin can access any contract', () => {
            expect(canAccessContract(admin, contractAtBranch)).toBe(true);
        });
    });

    it('GLOBAL_VIEW_ROLES includes CEO and Accountant', () => {
        expect(GLOBAL_VIEW_ROLES).toEqual(expect.arrayContaining(['CEO', 'Accountant']));
    });
});
