/** Loại chứng từ thuế — SRS Sprint 3 */
const TAX_DOCUMENT_TYPES = [
    'OUTPUT_VAT',
    'INPUT_VAT',
    'PIT',
    'SOCIAL_INSURANCE',
    'OTHER'
];

const TAX_DOCUMENT_LABELS = {
    OUTPUT_VAT: 'HĐ thuế đầu ra',
    INPUT_VAT: 'Chi phí đầu vào (VAT)',
    PIT: 'Thuế TNCN',
    SOCIAL_INSURANCE: 'BHXH',
    OTHER: 'Khác / không thuế'
};

/** Danh mục chi phí + miễn VAT mặc định */
const EXPENSE_CATEGORY_CONFIG = {
    Rent: { vatExempt: false, defaultTaxDoc: 'INPUT_VAT' },
    Electricity: { vatExempt: false, defaultTaxDoc: 'INPUT_VAT' },
    Water: { vatExempt: false, defaultTaxDoc: 'INPUT_VAT' },
    Equipment: { vatExempt: false, defaultTaxDoc: 'INPUT_VAT' },
    Maintenance: { vatExempt: false, defaultTaxDoc: 'INPUT_VAT' },
    Marketing: { vatExempt: false, defaultTaxDoc: 'INPUT_VAT' },
    Supplies: { vatExempt: false, defaultTaxDoc: 'INPUT_VAT' },
    Other: { vatExempt: false, defaultTaxDoc: 'OTHER' }
};

function isCategoryVatExempt(category) {
    return Boolean(EXPENSE_CATEGORY_CONFIG[category]?.vatExempt);
}

/**
 * Tính VAT và tổng: total = beforeVat + vatAmount (làm tròn VNĐ)
 */
function calculateExpenseVat({ amountBeforeVat, vatRate, vatExempt }) {
    const before = Math.max(0, Math.round(Number(amountBeforeVat) || 0));
    if (vatExempt) {
        return { amountBeforeVat: before, vatRate: 0, vatAmount: 0, total: before };
    }
    const rate = Math.min(100, Math.max(0, Number(vatRate) || 0));
    const vatAmount = Math.round((before * rate) / 100);
    return {
        amountBeforeVat: before,
        vatRate: rate,
        vatAmount,
        total: before + vatAmount
    };
}

/** Trường tổng dùng khi aggregate (ưu tiên total, fallback amount cũ) */
function effectiveTotalExpr() {
    return { $ifNull: ['$total', '$amount'] };
}

module.exports = {
    TAX_DOCUMENT_TYPES,
    TAX_DOCUMENT_LABELS,
    EXPENSE_CATEGORY_CONFIG,
    isCategoryVatExempt,
    calculateExpenseVat,
    effectiveTotalExpr
};
