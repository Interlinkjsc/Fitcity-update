// Rp15/8 (158.xlsx ISSUE 1): macros là TỶ LỆ % năng lượng/ngày (protein/carbs/fat/fiber).
// Rule: mỗi giá trị 0..100, tổng = 100 (dung sai ±0.5 để tránh lỗi làm tròn nhập tay).
function normalizeMacros(input = {}, defaults = { protein: 30, carbs: 35, fat: 25, fiber: 10 }) {
    const pick = (k) => {
        const v = input[k];
        if (v === '' || v == null) return defaults[k];
        const n = Number(v);
        return Number.isFinite(n) ? n : defaults[k];
    };
    return { protein: pick('protein'), carbs: pick('carbs'), fat: pick('fat'), fiber: pick('fiber') };
}

function validateMacros(m) {
    const keys = ['protein', 'carbs', 'fat', 'fiber'];
    for (const k of keys) {
        const v = Number(m[k]);
        if (!Number.isFinite(v) || v < 0 || v > 100) return `Tỷ lệ ${k} phải từ 0 đến 100%.`;
    }
    const sum = keys.reduce((s, k) => s + Number(m[k] || 0), 0);
    if (Math.abs(sum - 100) > 0.5) return `Tổng phân bổ macros phải bằng 100% (hiện ${sum}%).`;
    return null;
}

module.exports = { normalizeMacros, validateMacros };
