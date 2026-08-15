/**
 * Rp 15/8 (158.xlsx v2) — CONTRACT CHÍNH THỨC cho danh sách khách hàng:
 *   dùng CHUNG cho: Xuất Excel · Tải mẫu import · detect header · parser import · label lỗi.
 * Không khai báo mảng cột ở nơi khác — mọi thay đổi schema phải sửa ở đây (test contract sẽ fail nếu lệch).
 *
 * Mỗi field: { key, header, aliases[], required, importable, exportable, excel:{width,numFmt}, normalize(raw), validate(value) → null|msg }
 *   - header  : tiêu đề tiếng Việt chính thức (export + template)
 *   - aliases : tiêu đề chấp nhận khi import (đã bỏ dấu, chữ thường — so khớp qua stripDiacritics)
 *   - required: bắt buộc khi TẠO MỚI qua import
 *   - importable=false: chỉ có mặt trong file export (thông tin), importer bỏ qua CÓ CHỦ ĐÍCH
 */
const { normalizePhone, normalizeCccd, stripDiacritics } = require('../../utils/importNormalize');

const GENDER_MAP = { 'nam': 'Nam', 'male': 'Nam', 'm': 'Nam', 'nu': 'Nữ', 'nữ': 'Nữ', 'female': 'Nữ', 'f': 'Nữ', 'khac': 'Khác', 'khác': 'Khác', 'other': 'Khác' };
const STATUS_ENUM = ['Active', 'Suspended', 'Resigned'];

/** dd/MM/yyyy (cũng nhận d/M/yyyy, dấu - hoặc .), ISO yyyy-mm-dd, hoặc Date. Reject ngày không tồn tại (31/02). */
function parseDobStrict(raw) {
    if (raw == null || raw === '') return { value: undefined };
    if (raw instanceof Date) {
        if (Number.isNaN(raw.getTime())) return { error: 'Ngày sinh không hợp lệ' };
        // Excel Date cell → lấy Y/M/D theo UTC (exceljs trả UTC midnight) để không lệch ngày theo TZ
        return { value: new Date(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()) };
    }
    const s = String(raw).trim();
    let d, m, y;
    let mm = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s);
    if (mm) { d = +mm[1]; m = +mm[2]; y = +mm[3]; }
    else {
        mm = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(s);
        if (mm) { y = +mm[1]; m = +mm[2]; d = +mm[3]; }
        else return { error: `Ngày sinh "${s}" sai định dạng (cần dd/mm/yyyy)` };
    }
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return { error: `Ngày sinh "${s}" không tồn tại` };
    if (y < 1900 || dt > new Date()) return { error: `Ngày sinh "${s}" ngoài phạm vi hợp lệ` };
    return { value: dt };
}

function formatDob(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const CLIENT_FIELDS = [
    {
        key: 'name', header: 'Họ tên',
        aliases: ['ho ten', 'ho va ten', 'ten khach hang', 'ten kh', 'khach hang', 'ten', 'name', 'full name', 'customer'],
        required: true, importable: true, exportable: true, excel: { width: 24 },
        normalize: (v) => String(v || '').trim().replace(/\s+/g, ' '),
        validate: (v) => (!v ? 'thiếu tên' : v.length < 2 ? 'tên quá ngắn' : null)
    },
    {
        key: 'phone', header: 'Số điện thoại',
        aliases: ['so dien thoai', 'sdt', 'dien thoai', 'so dt', 'phone', 'mobile', 'tel', 'so may'],
        required: true, importable: true, exportable: true, excel: { width: 16, numFmt: '@' },
        normalize: (v) => normalizePhone(v),
        validate: (v) => (!v ? 'thiếu SĐT' : !/^0\d{9}$/.test(v) ? `SĐT "${v}" không hợp lệ (cần 10 số bắt đầu bằng 0)` : null)
    },
    {
        key: 'email', header: 'Email',
        aliases: ['email', 'e mail', 'mail', 'thu dien tu'],
        required: false, importable: true, exportable: true, excel: { width: 26 },
        normalize: (v) => String(v || '').trim().toLowerCase(),
        validate: (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? `email "${v}" không hợp lệ` : null)
    },
    {
        key: 'cccd', header: 'Số CCCD',
        aliases: ['so cccd', 'cccd', 'cmnd', 'so cmnd', 'can cuoc', 'can cuoc cong dan', 'id number', 'so cccd cmnd'],
        required: false, importable: true, exportable: true, excel: { width: 18, numFmt: '@' },
        normalize: (v) => normalizeCccd(v),
        validate: (v) => (v && !/^\d{12}$/.test(v) ? `CCCD "${v}" không hợp lệ (phải đủ 12 số)` : null)
    },
    {
        key: 'gender', header: 'Giới tính',
        aliases: ['gioi tinh', 'gender', 'sex'],
        required: false, importable: true, exportable: true, excel: { width: 10 },
        normalize: (v) => { const k = stripDiacritics(v); if (!k) return ''; return GENDER_MAP[k] || GENDER_MAP[String(v).trim().toLowerCase()] || String(v).trim(); },
        validate: (v) => (v && !['Nam', 'Nữ', 'Khác'].includes(v) ? `giới tính "${v}" không hợp lệ (Nam/Nữ/Khác)` : null)
    },
    {
        key: 'dob', header: 'Ngày sinh',
        aliases: ['ngay sinh', 'sinh nhat', 'dob', 'birthday', 'date of birth'],
        required: false, importable: true, exportable: true, excel: { width: 14, numFmt: '@' },
        normalize: (v) => v, // giữ raw, validate/parse strict ở validate
        validate: (v) => (parseDobStrict(v).error || null),
        toValue: (v) => parseDobStrict(v).value,
        toExport: (v) => formatDob(v)
    },
    {
        key: 'address', header: 'Địa chỉ',
        aliases: ['dia chi', 'address', 'dia chi lien he'],
        required: false, importable: true, exportable: true, excel: { width: 30 },
        normalize: (v) => String(v || '').trim(),
        validate: () => null
    },
    {
        key: 'branch', header: 'Chi nhánh',
        aliases: ['chi nhanh', 'co so', 'branch', 'phong tap'],
        required: true, importable: true, exportable: true, excel: { width: 26 },
        normalize: (v) => String(v || '').trim().replace(/\s+/g, ' '),
        validate: () => null // resolve + lỗi cụ thể ở resolveBranch
    },
    {
        key: 'status', header: 'Trạng thái',
        aliases: ['trang thai', 'status'],
        required: false, importable: false, exportable: true, excel: { width: 12 },
        // importer BỎ QUA CÓ CHỦ ĐÍCH: tạo mới luôn Active (không import trạng thái tài khoản từ file)
        normalize: (v) => String(v || '').trim(),
        validate: () => null,
        enum: STATUS_ENUM
    }
];

const byKey = Object.fromEntries(CLIENT_FIELDS.map(f => [f.key, f]));

function getExportColumns() { return CLIENT_FIELDS.filter(f => f.exportable); }
function getTemplateColumns() { return CLIENT_FIELDS.filter(f => f.importable); }
function getImportRequiredKeys() { return CLIENT_FIELDS.filter(f => f.importable && f.required).map(f => f.key); }
function getHeaderAliases() {
    const out = {};
    for (const f of CLIENT_FIELDS) out[f.key] = [stripDiacritics(f.header), ...f.aliases];
    return out;
}
function fieldLabel(key) { return byKey[key] ? byKey[key].header : key; }

/** Từ 1 client doc (đã decrypt getter) → row export theo schema */
function formatExportRow(c) {
    const email = c.email && !String(c.email).includes(':') ? c.email : '';
    return {
        name: c.name || '',
        phone: c.phone || '',
        email,
        cccd: c.cccdNumber || '',
        gender: c.gender || '',
        dob: formatDob(c.dob),
        address: c.address || '',
        branch: c.branch && c.branch.name ? c.branch.name : '',
        status: c.status || ''
    };
}

/**
 * Chuẩn hoá + validate 1 dòng import (KHÔNG resolve branch, không đụng DB).
 * @returns {{ values: Object, errors: string[] }}
 */
function normalizeAndValidateRow(rawByKey) {
    const values = {};
    const errors = [];
    for (const f of CLIENT_FIELDS) {
        if (!f.importable) continue;
        const raw = rawByKey[f.key];
        const v = f.normalize(raw);
        values[f.key] = v;
        if (f.required && (v === '' || v == null)) {
            if (f.key === 'branch') continue; // báo qua resolveBranch (BRANCH_MISSING) để có message đúng
            errors.push(f.validate(v) || `thiếu ${f.header.toLowerCase()}`);
            continue;
        }
        const err = f.validate(v);
        if (err) errors.push(err);
    }
    if (!errors.length && byKey.dob.toValue) values.dob = byKey.dob.toValue(values.dob);
    return { values, errors };
}

module.exports = {
    CLIENT_FIELDS, GENDER_MAP, STATUS_ENUM,
    getExportColumns, getTemplateColumns, getImportRequiredKeys, getHeaderAliases, fieldLabel,
    formatExportRow, normalizeAndValidateRow, parseDobStrict, formatDob
};
