const {
    mergeCategoryBreakdown,
    PAYROLL_CATEGORY
} = require('../../src/modules/finance/services/expenseAggregateService');

describe('expenseAggregateService', () => {
    it('mergeCategoryBreakdown adds Payroll category', () => {
        const merged = mergeCategoryBreakdown(
            [{ _id: 'Rent', total: 1000, count: 1 }],
            500000,
            2
        );
        expect(merged.find((c) => c._id === PAYROLL_CATEGORY)).toEqual({
            _id: PAYROLL_CATEGORY,
            total: 500000,
            count: 2
        });
    });
});
