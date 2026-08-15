/**
 * Rp 15/8 (158.xlsx v2) — Resolve chi nhánh khi import khách hàng: FAIL-SAFE + lỗi ĐÚNG NGUYÊN NHÂN.
 *
 * So khớp: canonical (NFC + trim + collapse space + lowercase) → nếu không có, accentless exact.
 * KHÔNG fuzzy. Nhiều kết quả accentless → BRANCH_AMBIGUOUS (không tự chọn).
 * Manager: chỉ được import vào chi nhánh của mình; ô trống → dùng chi nhánh Manager; khác → BRANCH_FORBIDDEN;
 *          Manager chưa gán chi nhánh → BRANCH_FORBIDDEN (fail-closed).
 * Admin/SA/khác: ô trống → BRANCH_MISSING (KHÔNG âm thầm gán); không tìm thấy → BRANCH_NOT_FOUND (KHÔNG fallback session).
 * Chỉ import vào chi nhánh Open (Closed/Maintenance → BRANCH_CLOSED).
 */
const Branch = require('../crm/models/branchModel.js');

function canonical(s) {
    return String(s || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}
function accentless(s) {
    return canonical(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/** Tải 1 lần trước vòng lặp import (tránh N+1). */
async function loadBranchCache() {
    const rows = await Branch.find({}).select('_id name status').lean();
    const byCanon = new Map();
    const byAccentless = new Map();
    for (const b of rows) {
        const c = canonical(b.name), a = accentless(b.name);
        if (!byCanon.has(c)) byCanon.set(c, []);
        byCanon.get(c).push(b);
        if (!byAccentless.has(a)) byAccentless.set(a, []);
        byAccentless.get(a).push(b);
    }
    return { rows, byCanon, byAccentless, byId: new Map(rows.map(b => [String(b._id), b])) };
}

const ERROR_MESSAGES = {
    BRANCH_MISSING: () => 'ô Chi nhánh trống — cần điền đúng tên chi nhánh',
    BRANCH_NOT_FOUND: (n) => `không tìm thấy chi nhánh "${n}" trong hệ thống`,
    BRANCH_AMBIGUOUS: (n, list) => `tên chi nhánh "${n}" khớp nhiều chi nhánh (${list.join(' / ')}) — ghi đúng tên có dấu`,
    BRANCH_CLOSED: (n) => `chi nhánh "${n}" đã đóng/bảo trì, không thể import`,
    BRANCH_FORBIDDEN: (n) => n ? `không có quyền import vào chi nhánh "${n}"` : 'tài khoản Manager chưa được gán chi nhánh',
    BRANCH_SESSION_INVALID: () => 'chi nhánh trong phiên đăng nhập không hợp lệ — đăng nhập lại'
};

/**
 * @param {string} name        tên chi nhánh trong file (có thể rỗng)
 * @param {Object} sessionUser {role, branch}
 * @param {Object} cache       từ loadBranchCache()
 * @returns {{branchId: ObjectId, branchName: string}} | {error: string, message: string}
 */
function resolveBranch(name, sessionUser, cache) {
    const role = sessionUser && sessionUser.role;
    const sessBranch = sessionUser && sessionUser.branch ? String(sessionUser.branch) : null;
    const isManager = role === 'Manager';
    const raw = String(name || '').trim();

    // Manager: khoá cứng theo chi nhánh của mình
    if (isManager) {
        if (!sessBranch) return { error: 'BRANCH_FORBIDDEN', message: ERROR_MESSAGES.BRANCH_FORBIDDEN('') };
        const mine = cache.byId.get(sessBranch);
        if (!mine) return { error: 'BRANCH_SESSION_INVALID', message: ERROR_MESSAGES.BRANCH_SESSION_INVALID() };
        if (!raw) {
            if (mine.status !== 'Open') return { error: 'BRANCH_CLOSED', message: ERROR_MESSAGES.BRANCH_CLOSED(mine.name) };
            return { branchId: mine._id, branchName: mine.name };
        }
        const found = matchBranch(raw, cache);
        if (found.error) return found;
        if (String(found.branch._id) !== sessBranch) return { error: 'BRANCH_FORBIDDEN', message: ERROR_MESSAGES.BRANCH_FORBIDDEN(raw) };
        if (found.branch.status !== 'Open') return { error: 'BRANCH_CLOSED', message: ERROR_MESSAGES.BRANCH_CLOSED(found.branch.name) };
        return { branchId: found.branch._id, branchName: found.branch.name };
    }

    // Admin/SA/…: KHÔNG dùng session branch làm mặc định ngầm
    if (!raw) return { error: 'BRANCH_MISSING', message: ERROR_MESSAGES.BRANCH_MISSING() };
    const found = matchBranch(raw, cache);
    if (found.error) return found;
    if (found.branch.status !== 'Open') return { error: 'BRANCH_CLOSED', message: ERROR_MESSAGES.BRANCH_CLOSED(found.branch.name) };
    return { branchId: found.branch._id, branchName: found.branch.name };
}

function matchBranch(raw, cache) {
    const c = canonical(raw);
    let list = cache.byCanon.get(c) || [];
    if (list.length === 1) return { branch: list[0] };
    if (list.length > 1) return { error: 'BRANCH_AMBIGUOUS', message: ERROR_MESSAGES.BRANCH_AMBIGUOUS(raw, list.map(b => b.name)) };
    const a = accentless(raw);
    list = cache.byAccentless.get(a) || [];
    if (list.length === 1) return { branch: list[0] };
    if (list.length > 1) return { error: 'BRANCH_AMBIGUOUS', message: ERROR_MESSAGES.BRANCH_AMBIGUOUS(raw, list.map(b => b.name)) };
    return { error: 'BRANCH_NOT_FOUND', message: ERROR_MESSAGES.BRANCH_NOT_FOUND(raw) };
}

module.exports = { resolveBranch, loadBranchCache, canonical, accentless, ERROR_MESSAGES };
