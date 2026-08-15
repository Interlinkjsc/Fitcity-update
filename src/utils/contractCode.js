// Rp15/8 (158.xlsx ISSUE 0): 1 helper duy nhất sinh mã HĐ theo quy tắc FitCity
//   `DD.MM.YYYY/<VIẾT TẮT TÊN KH>`  ví dụ 12.07.2026/NVA
// - Viết tắt = chữ cái đầu mỗi từ, BỎ DẤU tiếng Việt (Đặng → D, Ăn → A), tối đa 4 ký tự, fallback 'KH'.
// - Trùng (cùng ngày + cùng viết tắt) → hậu tố -2, -3…
// - Mã cũ (FMS-*, mã nhập tay) KHÔNG bị regenerate — chỉ áp dụng khi tạo mới không có mã.

function stripVi(s) {
    return String(s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function initialsOf(name) {
    const words = stripVi(name).trim().split(/\s+/).filter(Boolean);
    const ini = words.map(w => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    return ini || 'KH';
}

function datePart(d = new Date()) {
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/**
 * @param {string} clientName
 * @param {(code:string)=>Promise<boolean>} existsFn  trả true nếu mã đã tồn tại
 * @param {Date} [date]
 */
async function generateContractCode(clientName, existsFn, date = new Date()) {
    const base = `${datePart(date)}/${initialsOf(clientName)}`;
    let candidate = base;
    let n = 1;
    try {
        while (await existsFn(candidate)) {
            n++;
            candidate = `${base}-${n}`;
        }
    } catch (_) { /* existsFn lỗi (mock) → dùng candidate hiện tại */ }
    return candidate;
}

module.exports = { generateContractCode, initialsOf, datePart, stripVi };
