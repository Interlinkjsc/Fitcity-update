// Rp27/7 A3: chuẩn hoá dữ liệu đọc từ Excel/CSV khi import khách hàng.
// Excel lưu SĐT/CCCD dạng number → mất số 0 đầu; cell có thể là richText/formula/hyperlink.

/** Đọc giá trị cell exceljs về string an toàn (richText/formula/hyperlink/Date/number). */
function cellText(row, col) {
    const v = row.getCell(col).value;
    if (v == null) return '';
    if (typeof v === 'object') {
        if (v.richText) return v.richText.map(r => r.text).join('').trim();
        if (v.text) return String(v.text).trim();
        if (v.result != null) return String(v.result).trim();
        if (v instanceof Date) return v.toISOString();
        return String(v).trim();
    }
    return String(v).trim();
}

/** SĐT VN 10 số bắt đầu 0. Tự khôi phục số 0 đầu bị Excel nuốt, đổi +84/84 → 0. */
function normalizePhone(raw) {
    let d = String(raw || '').replace(/[^\d+]/g, '');
    if (d.startsWith('+84')) d = '0' + d.slice(3);
    else if (d.startsWith('84') && d.length >= 10) d = '0' + d.slice(2);
    d = d.replace(/\D/g, '');
    if (d.length === 9 && !d.startsWith('0')) d = '0' + d;
    return d;
}

/** CCCD 12 số — thêm lại số 0 đầu nếu Excel làm mất (còn 11 số). */
function normalizeCccd(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d && d.length === 11) d = '0' + d;
    return d;
}

module.exports = { cellText, normalizePhone, normalizeCccd };
