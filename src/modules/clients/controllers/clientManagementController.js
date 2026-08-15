const clientManagementService = require('../services/clientManagementService');
const { ClientServiceError } = require('../services/clientManagementService');
const Lead = require('../../crm/models/leadModel.js');
const Branch = require('../../crm/models/branchModel.js');
const Coupon = require('../../finance/models/couponModel.js');
const { hash } = require('../../../utils/encryption.js');
const { sendClientWelcomeEmail } = require('../../platform/services/welcomeEmailService.js');

function normalizeVnPhone(s) {
    if (s == null || typeof s !== 'string') return '';
    let t = s.replace(/\s/g, '');
    if (t.startsWith('+84')) t = `0${t.slice(3)}`;
    return t;
}

exports.getClientList = async (req, res, next) => {
    try {
        const { clients, pagination, query } = await clientManagementService.getClientList(req.query, req.session.user);

        const assignableCoupons = await Coupon.find({
            active: true,
            usageLimit: { $gt: 0 },
            endDate: { $gte: new Date() }
        })
            .select('code type value')
            .sort({ code: 1 })
            .lean();

        res.render('admin/clients/list', {
            clients,
            pagination,
            query,
            assignableCoupons,
            activePage: 'clients'
        });
    } catch (err) {
        next(err);
    }
};

exports.getCreateForm = async (req, res, next) => {
    try {
        const { isEdit, clientData } = clientManagementService.getCreateFormData();
        const branches = await Branch.find({ status: { $ne: 'Closed' } })
            .select('name')
            .sort({ name: 1 })
            .lean();
        res.render('admin/clients/form', {
            isEdit,
            clientData,
            branches,
            activePage: 'clients'
        });
    } catch (err) {
        next(err);
    }
};

exports.storeClient = async (req, res, next) => {
    try {
        /** R6 (act-11): có lead mở trùng email → ưu tiên Convert từ CRM, không tạo client “trắng”. */
        const emailTrim = typeof req.body.email === 'string' ? req.body.email.trim() : '';
        if (emailTrim) {
            const openLead = await Lead.findOne({
                emailHash: hash(emailTrim.toLowerCase()),
                status: { $ne: 'Converted' }
            })
                .select('_id')
                .lean();
            if (openLead) {
                req.flash(
                    'error_msg',
                    'Đã có lead mở với email này. Chuyển thành hội viên từ chi tiết Lead (CRM) để đồng bộ dữ liệu.'
                );
                return res.redirect(`/admin/leads/detail/${openLead._id}`);
            }
        }

        const phoneTrim = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
        if (phoneTrim) {
            const openLeads = await Lead.find({ status: { $ne: 'Converted' } })
                .select('_id phone');
            const target = normalizeVnPhone(phoneTrim);
            if (target) {
                for (const L of openLeads) {
                    if (L.phone && normalizeVnPhone(String(L.phone)) === target) {
                        req.flash(
                            'error_msg',
                            'Đã có lead mở với số điện thoại này. Chuyển thành hội viên từ chi tiết Lead (CRM) để đồng bộ dữ liệu.'
                        );
                        return res.redirect(`/admin/leads/detail/${L._id}`);
                    }
                }
            }
        }

        const client = await clientManagementService.createClient(req.body);
        await sendClientWelcomeEmail(client, 'admin_store');
        req.flash('success_msg', 'Tạo khách hàng thành công!');
        res.redirect('/admin/clients/list');
    } catch (err) {
        if (err instanceof ClientServiceError && err.code === 'DUPLICATE_EMAIL') {
            req.flash('error_msg', err.message);
            return res.redirect('/admin/clients/create');
        }
        if (
            err instanceof ClientServiceError &&
            (
                err.code === 'MISSING_BRANCH' ||
                err.code === 'INVALID_BRANCH' ||
                err.code === 'INVALID_NAME' ||
                err.code === 'INVALID_EMAIL' ||
                err.code === 'INVALID_PASSWORD' ||
                err.code === 'INVALID_STATUS'
            )
        ) {
            req.flash('error_msg', err.message);
            return res.redirect('/admin/clients/create');
        }
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message).join(', ');
            req.flash('error_msg', messages);
            return res.redirect('/admin/clients/create');
        }
        next(err);
    }
};

exports.getEditForm = async (req, res, next) => {
    try {
        const { isEdit, clientData } = await clientManagementService.getEditFormData(req.params.id);

        const branches = await Branch.find({ status: { $ne: 'Closed' } })
            .select('name')
            .sort({ name: 1 })
            .lean();

        res.render('admin/clients/form', {
            isEdit,
            clientData,
            branches,
            activePage: 'clients'
        });
    } catch (err) {
        if (err instanceof ClientServiceError && err.code === 'CLIENT_NOT_FOUND') {
            req.flash('error_msg', err.message);
            return res.redirect('/admin/clients/list');
        }
        next(err);
    }
};

exports.updateClient = async (req, res, next) => {
    try {
        await clientManagementService.updateClient(req.params.id, req.body);
        req.flash('success_msg', 'Cập nhật hồ sơ khách hàng thành công!');
        res.redirect('/admin/clients/list');
    } catch (err) {
        if (err instanceof ClientServiceError && err.code === 'DUPLICATE_EMAIL') {
            req.flash('error_msg', err.message);
            return res.redirect(`/admin/clients/edit/${req.params.id}`);
        }
        if (err instanceof ClientServiceError && err.code === 'CLIENT_NOT_FOUND') {
            req.flash('error_msg', 'Không tìm thấy khách hàng để cập nhật!');
            return res.redirect('/admin/clients/list');
        }
        if (
            err instanceof ClientServiceError &&
            (
                err.code === 'MISSING_BRANCH' ||
                err.code === 'INVALID_BRANCH' ||
                err.code === 'INVALID_NAME' ||
                err.code === 'INVALID_EMAIL' ||
                err.code === 'INVALID_PASSWORD' ||
                err.code === 'INVALID_STATUS'
            )
        ) {
            req.flash('error_msg', err.message);
            return res.redirect(`/admin/clients/edit/${req.params.id}`);
        }
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message).join(', ');
            req.flash('error_msg', messages);
            return res.redirect(`/admin/clients/edit/${req.params.id}`);
        }
        next(err);
    }
};

exports.getDetail = async (req, res, next) => {
    try {
        const detail = await clientManagementService.getClientDetailData(req.params.id);
        const {
            clientData,
            contracts,
            stats,
            upcomingSessions,
            sessionHistory,
            bodyMetrics,
            mealPlans,
            progressInsight
        } = detail;

        res.render('admin/clients/details', {
            clientData,
            contracts,
            stats,
            upcomingSessions,
            sessionHistory,
            bodyMetrics,
            mealPlans,
            progressInsight,
            activePage: 'clients'
        });
    } catch (err) {
        if (err instanceof ClientServiceError && err.code === 'CLIENT_NOT_FOUND') {
            req.flash('error_msg', err.message);
            return res.redirect('/admin/clients/list');
        }
        next(err);
    }
};

exports.deleteClient = async (req, res, next) => {
    try {
        await clientManagementService.deleteClient(req.params.id);
        req.flash('success_msg', 'Đã xóa khách hàng khỏi hệ thống.');
        return res.redirect('/admin/clients/list');
    } catch (err) {
        if (err instanceof ClientServiceError) {
            if (err.code === 'CLIENT_NOT_FOUND') {
                req.flash('error_msg', err.message);
                return res.redirect('/admin/clients/list');
            }
            if (err.code === 'HAS_CONTRACTS') {
                req.flash('error_msg', err.message);
                return res.redirect(`/admin/clients/detail/${req.params.id}`);
            }
        }
        next(err);
    }
};


/* ============================================================================
 * Rp 15/8 (158.xlsx v2) — XUẤT / MẪU / IMPORT khách hàng dùng CHUNG 1 CONTRACT:
 *   src/modules/clients/clientImportSchema.js (cột, alias, required, normalize, validate, format)
 *   src/modules/clients/resolveBranch.js      (chi nhánh: fail-safe, lỗi đúng nguyên nhân)
 * Round-trip bắt buộc: file "Xuất Excel" → thêm dòng → import phải chạy; dòng cũ báo trùng, không MISSING_BRANCH sai.
 * ========================================================================== */
const clientImportSchema = require('../clientImportSchema');
const { resolveBranch, loadBranchCache } = require('../resolveBranch');

// chống formula injection khi xuất Excel (=, +, -, @ đầu ô)
function safeCell(v) {
    const t = v == null ? '' : String(v);
    return /^[=+\-@]/.test(t) ? "'" + t : t;
}

// Bug 23/7 A16 + Rp15/8 v2: Xuất danh sách khách hàng ra Excel (.xlsx) — cột từ schema chung
exports.exportClients = async (req, res, next) => {
    try {
        const ExcelJS = require('exceljs');
        const User = require('../../users/models/userModel.js');
        const filters = { role: 'Client' };
        if (req.session.user.role === 'Manager') {
            // fail-closed: Manager chưa gán chi nhánh → không xuất gì
            filters.branch = req.session.user.branch || null;
        }
        const clients = await User.find(filters).populate('branch', 'name').sort({ createdAt: -1 });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'FitCity ERP';
        const ws = wb.addWorksheet('Khách hàng');
        const cols = clientImportSchema.getExportColumns();
        ws.columns = cols.map(f => ({ header: f.header, key: f.key, width: f.excel.width }));
        ws.getRow(1).font = { bold: true };
        cols.forEach(f => { if (f.excel.numFmt) ws.getColumn(f.key).numFmt = f.excel.numFmt; });
        for (const c of clients) {
            const row = clientImportSchema.formatExportRow(c);
            const out = {};
            cols.forEach(f => { out[f.key] = safeCell(row[f.key]); });
            ws.addRow(out);
        }
        ws.views = [{ state: 'frozen', ySplit: 1 }];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="danh_sach_kh_${Date.now()}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) { next(err); }
};

// Rp15/8 v2: file MẪU import — cột importable từ schema; hướng dẫn nằm ở SHEET RIÊNG (không lẫn vào vùng dữ liệu)
exports.downloadImportTemplate = async (req, res, next) => {
    try {
        const ExcelJS = require('exceljs');
        const wb = new ExcelJS.Workbook();
        wb.creator = 'FitCity ERP';
        const ws = wb.addWorksheet('Danh sách KH');
        const cols = clientImportSchema.getTemplateColumns();
        ws.columns = cols.map(f => ({ header: f.header, key: f.key, width: f.excel.width }));
        ws.getRow(1).font = { bold: true };
        cols.forEach(f => { if (f.excel.numFmt) ws.getColumn(f.key).numFmt = f.excel.numFmt; });
        ws.addRow({ name: 'Nguyễn Văn A', phone: '0912345678', email: 'a@example.com', cccd: '079212345678', gender: 'Nam', dob: '15/08/1990', address: '12 Lê Lợi, Q1', branch: 'FITCITY PARK12 TIMECITY' });
        ws.addRow({ name: 'Trần Thị B', phone: '0987654321', email: '', cccd: '', gender: 'Nữ', dob: '', address: '', branch: 'FITCITY PARK12 TIMECITY' });
        ws.views = [{ state: 'frozen', ySplit: 1 }];

        const guide = wb.addWorksheet('Hướng dẫn');
        guide.columns = [{ header: 'Cột', key: 'c', width: 18 }, { header: 'Bắt buộc', key: 'r', width: 10 }, { header: 'Ghi chú', key: 'n', width: 70 }];
        guide.getRow(1).font = { bold: true };
        const notes = {
            name: 'Họ tên đầy đủ', phone: '10 số bắt đầu bằng 0 (giữ định dạng chữ để không mất số 0)',
            email: 'Không bắt buộc; nếu có phải đúng định dạng và chưa dùng cho khách khác',
            cccd: '12 số (không bắt buộc)', gender: 'Nam / Nữ / Khác', dob: 'dd/mm/yyyy (ví dụ 15/08/1990)',
            address: 'Không bắt buộc', branch: 'Ghi ĐÚNG tên chi nhánh như trong hệ thống (không phân biệt hoa/thường, khoảng trắng)'
        };
        cols.forEach(f => guide.addRow({ c: f.header, r: f.required ? 'Có' : 'Không', n: notes[f.key] || '' }));
        guide.addRow({});
        guide.addRow({ c: 'Lưu ý', n: 'Xoá 2 dòng ví dụ trong sheet "Danh sách KH" trước khi import. Không đổi tên cột. File "Xuất Excel" cũng import lại được: dòng khách cũ sẽ báo trùng SĐT/email và bị bỏ qua, dòng mới sẽ được tạo.' });
        guide.addRow({ c: 'Chi nhánh hiện có', n: (await require('../../crm/models/branchModel.js').find({ status: 'Open' }).select('name').lean()).map(b => b.name).join(' | ') });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Mau_import_khach_hang.xlsx"');
        await wb.xlsx.write(res);
        res.end();
    } catch (err) { next(err); }
};

// Bug 23/7 A16 + Rp15/8 v2: Import danh sách khách hàng từ Excel/CSV theo schema chung
exports.importClients = async (req, res, next) => {
    const fs = require('fs');
    const path = req.importFile && req.importFile.path;
    const cleanup = () => { if (path) { try { fs.unlinkSync(path); } catch (_) {} } };
    try {
        if (!path) {
            req.flash('error_msg', 'Chưa chọn file danh sách (.xlsx hoặc .csv).');
            return res.redirect('/admin/clients/list');
        }
        const result = await exports._importClientsFromFile(path, req.importFile.filename, req.session.user);
        req.flash(result.level, result.message);
        return res.redirect('/admin/clients/list');
    } catch (err) {
        req.flash('error_msg', 'Lỗi đọc file import: ' + (err && err.message ? err.message : 'không rõ'));
        return res.redirect('/admin/clients/list');
    } finally {
        cleanup(); // luôn xoá file tạm — kể cả khi parse/service lỗi
    }
};

/**
 * Lõi import — tách riêng để test round-trip trực tiếp.
 * @returns {{ level:'success_msg'|'error_msg', message:string, created:number, skipped:number, skipReasons:string[], createdIds:ObjectId[] }}
 */
exports._importClientsFromFile = async (path, filename, sessionUser) => {
    const ExcelJS = require('exceljs');
    const { cellText, detectHeader } = require('../../../utils/importNormalize');
    const wb = new ExcelJS.Workbook();
    if (/\.csv$/i.test(filename || path)) await wb.csv.readFile(path);
    else await wb.xlsx.readFile(path);
    // Ưu tiên sheet dữ liệu (bỏ qua sheet "Hướng dẫn" của template)
    const ws = wb.worksheets.find(w => !/^h(ư|u)(ớ|o)ng d(ẫ|a)n$/i.test(w.name || '')) || wb.worksheets[0];
    if (!ws) return { level: 'error_msg', message: 'File không có sheet dữ liệu.', created: 0, skipped: 0, skipReasons: [], createdIds: [] };

    const requiredKeys = clientImportSchema.getImportRequiredKeys();
    const hdr = detectHeader(ws, requiredKeys, { aliases: clientImportSchema.getHeaderAliases() });
    if (!hdr) {
        return { level: 'error_msg', created: 0, skipped: 0, skipReasons: [], createdIds: [],
            message: `Không tìm thấy dòng tiêu đề trong 10 dòng đầu. File cần có các cột: ${requiredKeys.map(clientImportSchema.fieldLabel).join(', ')} (tải file mẫu ở nút "Tải mẫu import").` };
    }
    if (hdr.missing.length) {
        return { level: 'error_msg', created: 0, skipped: 0, skipReasons: [], createdIds: [],
            message: `File thiếu cột bắt buộc: ${hdr.missing.map(clientImportSchema.fieldLabel).join(', ')}. Không đọc theo vị trí cột để tránh nhầm dữ liệu — tải file mẫu và điền đúng tiêu đề.` };
    }
    if (hdr.ambiguous && hdr.ambiguous.length) {
        return { level: 'error_msg', created: 0, skipped: 0, skipReasons: [], createdIds: [],
            message: `File có nhiều cột cùng ý nghĩa: ${hdr.ambiguous.map(clientImportSchema.fieldLabel).join(', ')}. Giữ lại 1 cột cho mỗi trường.` };
    }

    const branchCache = await loadBranchCache();
    const importableKeys = clientImportSchema.getTemplateColumns().map(f => f.key);
    const get = (row, key) => (hdr.map[key] != null ? cellText(row, hdr.map[key]) : '');

    let created = 0, skipped = 0;
    const skipReasons = [];
    const createdIds = [];
    const seenPhones = new Set();
    const rows = [];
    ws.eachRow((row, idx) => { if (idx > hdr.headerRow) rows.push({ row, idx }); });

    for (const { row, idx } of rows) {
        const rawByKey = {};
        importableKeys.forEach(k => { rawByKey[k] = get(row, k); });
        // dòng trống hoàn toàn / dòng ghi chú (chỉ có 1 ô text không phải tên+SĐT) → bỏ qua âm thầm
        const nonEmpty = importableKeys.filter(k => rawByKey[k] !== '' && rawByKey[k] != null);
        if (nonEmpty.length === 0) continue;
        if (nonEmpty.length === 1 && !rawByKey.phone && /^(ghi ch[uú]|l[uư]u [yý]|note)/i.test(String(rawByKey.name || ''))) continue;

        const { values, errors } = clientImportSchema.normalizeAndValidateRow(rawByKey);
        if (errors.length) { skipped++; skipReasons.push(`Dòng ${idx}: ${errors.join('; ')}`); continue; }
        if (seenPhones.has(values.phone)) { skipped++; skipReasons.push(`Dòng ${idx}: SĐT ${values.phone} trùng với dòng khác trong file`); continue; }

        const br = resolveBranch(values.branch, sessionUser, branchCache);
        if (br.error) { skipped++; skipReasons.push(`Dòng ${idx}: ${br.message}`); continue; }

        try {
            await exports._createClientFromImport({
                name: values.name, phone: values.phone,
                email: values.email || `import_${require('crypto').randomUUID()}@fitcity.temp`,
                branch: br.branchId,
                cccdNumber: values.cccd || undefined,
                gender: values.gender || undefined,
                address: values.address || undefined,
                dob: values.dob || undefined
            }, sessionUser && sessionUser.id).then(doc => { if (doc && doc._id) createdIds.push(doc._id); });
            seenPhones.add(values.phone);
            created++;
        } catch (e) {
            skipped++;
            const code = e && e.code;
            const msg = e && e.message ? e.message : '';
            let reason;
            if (code === 'DUPLICATE_PHONE') reason = `trùng SĐT — ${msg}`;
            else if (code === 'DUPLICATE_EMAIL') reason = `trùng email — email ${values.email} đã dùng cho khách khác`;
            else if (code === 'MISSING_BRANCH' || code === 'INVALID_BRANCH') reason = `chi nhánh không hợp lệ (${msg})`;
            else if (code === 'INVALID_NAME' || code === 'INVALID_EMAIL' || code === 'INVALID_STATUS' || code === 'INVALID_PASSWORD') reason = msg;
            else if (e && e.name === 'ValidationError') reason = Object.values(e.errors || {}).map(x => x.message).join(', ') || 'dữ liệu không hợp lệ';
            else if (/E11000|duplicate/i.test(msg)) reason = 'SĐT/email/CCCD đã tồn tại';
            else reason = msg && msg.length < 140 ? msg : 'dữ liệu không hợp lệ';
            skipReasons.push(`Dòng ${idx}: ${reason}`);
        }
    }

    let level, message;
    if (created > 0 && skipped === 0) { level = 'success_msg'; message = `Import THÀNH CÔNG: tạo mới ${created} khách hàng.`; }
    else if (created > 0) { level = 'success_msg'; message = `Import MỘT PHẦN: tạo mới ${created} khách hàng, bỏ qua ${skipped} dòng.`; }
    else if (skipped === 0) { level = 'error_msg'; message = 'File không có dòng dữ liệu khách hàng nào (sau dòng tiêu đề).'; }
    else { level = 'error_msg'; message = `Import THẤT BẠI: không tạo được khách hàng nào (bỏ qua ${skipped} dòng).`; }
    if (skipReasons.length) message += ' Chi tiết: ' + skipReasons.slice(0, 8).join('; ') + (skipReasons.length > 8 ? ` … (+${skipReasons.length - 8} dòng khác)` : '');
    return { level, message, created, skipped, skipReasons, createdIds };
};

exports._createClientFromImport = async (data, importedBy) => {
    const clientManagementService = require('../services/clientManagementService');
    const { ClientServiceError } = clientManagementService;
    const crypto = require('crypto');
    const { hash } = require('../../../utils/encryption');
    const Reservation = require('../models/clientImportReservationModel');

    // QA1 [HIGH]: đặt chỗ SĐT ATOMIC (unique index) TRƯỚC khi tạo user → 2 import đồng thời cùng SĐT
    // chỉ 1 request thắng; request kia nhận E11000 → DUPLICATE_PHONE. Không đụng users.phoneHash legacy.
    const phoneHash = hash(String(data.phone));
    const mongoose = require('mongoose');
    const importedById = importedBy && mongoose.Types.ObjectId.isValid(String(importedBy)) ? importedBy : null;
    let reservation;
    try {
        reservation = await Reservation.create({ phoneHash, importedBy: importedById });
    } catch (e) {
        if (e && e.code === 11000) {
            throw new ClientServiceError(`SĐT ${data.phone} đã tồn tại (đang/đã được import)`, 'DUPLICATE_PHONE');
        }
        throw e;
    }
    try {
        const doc = await clientManagementService.createClient({
            ...data,
            password: crypto.randomBytes(5).toString('hex'),
            status: 'Active',           // Trạng thái từ file export KHÔNG được import (bỏ qua có chủ đích)
            __checkDuplicatePhone: true // vẫn kiểm tra khách LEGACY đã có SĐT này trong users
        });
        await Reservation.updateOne({ _id: reservation._id }, { $set: { createdUser: doc._id } }).catch(() => {});
        return doc;
    } catch (e) {
        // tạo user thất bại (trùng email/legacy phone/validation) → trả chỗ để không khoá nhầm SĐT
        await Reservation.deleteOne({ _id: reservation._id }).catch(() => {});
        throw e;
    }
};
