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

/* ---------------------------------------------------------------------------
 * Rp15/8 (158.xlsx ISSUE 3): AUTO-DETECT HEADER theo tên cột (không đọc cứng theo vị trí).
 * File khách có STT ở đầu / đổi thứ tự cột / header ở dòng 2-3 vẫn đọc đúng.
 * ------------------------------------------------------------------------- */
function stripDiacritics(s) {
    return String(s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// alias đã bỏ dấu, chữ thường
const HEADER_ALIASES = {
    name:    ['ho ten', 'ho va ten', 'ten khach hang', 'ten kh', 'khach hang', 'ten', 'name', 'full name', 'customer'],
    phone:   ['so dien thoai', 'sdt', 'dien thoai', 'so dt', 'phone', 'mobile', 'tel', 'so may'],
    email:   ['email', 'e mail', 'mail', 'thu dien tu'],
    cccd:    ['so cccd', 'cccd', 'cmnd', 'so cmnd', 'can cuoc', 'can cuoc cong dan', 'id number', 'so cccd cmnd'],
    gender:  ['gioi tinh', 'gender', 'sex'],
    dob:     ['ngay sinh', 'sinh nhat', 'dob', 'birthday', 'date of birth'],
    address: ['dia chi', 'address', 'dia chi lien he'],
    branch:  ['chi nhanh', 'co so', 'branch', 'phong tap'],
    status:  ['trang thai', 'status']
};

/**
 * Tìm dòng header trong 10 dòng đầu + map key → chỉ số cột.
 * @returns {{ headerRow: number, map: Object<string, number>, missing: string[] }|null}
 */
function detectHeader(ws, requiredKeys = ['name', 'phone']) {
    const maxScan = Math.min(ws.rowCount || 10, 10);
    let best = null;
    for (let r = 1; r <= maxScan; r++) {
        const row = ws.getRow(r);
        const map = {};
        const colCount = row.cellCount || (ws.columnCount || 0);
        for (let c = 1; c <= Math.max(colCount, ws.columnCount || 0); c++) {
            const raw = cellText(row, c);
            if (!raw) continue;
            const key = stripDiacritics(raw);
            for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
                if (map[field] != null) continue;
                if (aliases.includes(key) || aliases.some(a => key === a || key.startsWith(a + ' ') || key.endsWith(' ' + a))) {
                    map[field] = c;
                    break;
                }
            }
        }
        const found = Object.keys(map).length;
        if (found >= 2 && (!best || found > best.found)) best = { headerRow: r, map, found };
        if (best && best.found >= 5) break;
    }
    if (!best) return null;
    const missing = requiredKeys.filter(k => best.map[k] == null);
    return { headerRow: best.headerRow, map: best.map, missing };
}

module.exports = { cellText, normalizePhone, normalizeCccd, detectHeader, stripDiacritics, HEADER_ALIASES };
