const {
    calculateExpenseVat,
    isCategoryVatExempt,
    TAX_DOCUMENT_TYPES
} = require('../../src/utils/expenseVatHelper');

describe('expenseVatHelper', () => {
    it('calculates total = beforeVat + vatAmount', () => {
        const r = calculateExpenseVat({ amountBeforeVat: 1000000, vatRate: 10 });
        expect(r.amountBeforeVat).toBe(1000000);
        expect(r.vatAmount).toBe(100000);
        expect(r.total).toBe(1100000);
    });

    it('vat exempt forces zero vat', () => {
        const r = calculateExpenseVat({ amountBeforeVat: 500000, vatRate: 10, vatExempt: true });
        expect(r.vatRate).toBe(0);
        expect(r.vatAmount).toBe(0);
        expect(r.total).toBe(500000);
    });

    it('exposes tax document types', () => {
        expect(TAX_DOCUMENT_TYPES).toContain('INPUT_VAT');
    });

    it('category vat exempt defaults false', () => {
        expect(isCategoryVatExempt('Rent')).toBe(false);
    });
});
