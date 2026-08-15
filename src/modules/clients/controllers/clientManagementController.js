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


// Bug 23/7 A16: Xuất danh sách khách hàng ra Excel (.xlsx)
exports.exportClients = async (req, res, next) => {
    try {
        const ExcelJS = require('exceljs');
        const User = require('../../users/models/userModel.js');
        const filters = { role: 'Client' };
        if (req.session.user.role === 'Manager' && req.session.user.branch) {
            filters.branch = req.session.user.branch;
        }
        const clients = await User.find(filters).populate('branch', 'name').sort({ createdAt: -1 });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Khách hàng');
        ws.columns = [
            { header: 'Họ tên', key: 'name', width: 24 },
            { header: 'Số điện thoại', key: 'phone', width: 16 },
            { header: 'Email', key: 'email', width: 26 },
            { header: 'Số CCCD', key: 'cccd', width: 18 },
            { header: 'Giới tính', key: 'gender', width: 10 },
            { header: 'Ngày sinh', key: 'dob', width: 14 },
            { header: 'Địa chỉ', key: 'address', width: 30 },
            { header: 'Chi nhánh', key: 'branch', width: 22 },
            { header: 'Trạng thái', key: 'status', width: 12 }
        ];
        ws.getRow(1).font = { bold: true };
        // Rp27/7 A3: ép cột SĐT/CCCD định dạng TEXT để Excel không nuốt số 0 đầu khi khách mở/sửa file
        ws.getColumn('phone').numFmt = '@';
        ws.getColumn('cccd').numFmt = '@';
        clients.forEach(c => {
            ws.addRow({
                name: c.name || '',
                phone: c.phone || '',
                email: (c.email && !String(c.email).includes(':')) ? c.email : '',
                cccd: c.cccdNumber || '',
                gender: c.gender || '',
                dob: c.dob ? new Date(c.dob).toLocaleDateString('vi-VN') : '',
                address: c.address || '',
                branch: c.branch ? c.branch.name : '',
                status: c.status || ''
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="danh_sach_kh_${Date.now()}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) { next(err); }
};

// Bug 23/7 A16: Import danh sách khách hàng từ Excel/CSV
exports.importClients = async (req, res, next) => {
    try {
        if (!req.importFile || !req.importFile.path) {
            req.flash('error_msg', 'Chưa chọn file danh sách (.xlsx hoặc .csv).');
            return res.redirect('/admin/clients/list');
        }
        const ExcelJS = require('exceljs');
        const fs = require('fs');
        const wb = new ExcelJS.Workbook();
        const path = req.importFile.path;
        if (/\.csv$/i.test(req.importFile.filename || path)) {
            await wb.csv.readFile(path);
        } else {
            await wb.xlsx.readFile(path);
        }
        const ws = wb.worksheets[0];
        if (!ws) {
            try { fs.unlinkSync(path); } catch (_) {}
            req.flash('error_msg', 'File không có sheet dữ liệu.');
            return res.redirect('/admin/clients/list');
        }
        let created = 0, skipped = 0;
        const skipReasons = [];

        // Rp27/7 A3 + Rp15/8 ISSUE 3: chuẩn hoá cell, khôi phục số 0 đầu, AUTO-DETECT HEADER theo tên cột
        const { cellText, normalizePhone, normalizeCccd, detectHeader } = require('../../../utils/importNormalize');
        const hdr = detectHeader(ws, ['name', 'phone']);
        if (!hdr) {
            try { fs.unlinkSync(path); } catch (_) {}
            req.flash('error_msg', 'Không tìm thấy dòng tiêu đề trong 10 dòng đầu. File cần có cột "Họ tên" và "Số điện thoại" (tải file mẫu ở nút "Tải mẫu import").');
            return res.redirect('/admin/clients/list');
        }
        if (hdr.missing.length) {
            try { fs.unlinkSync(path); } catch (_) {}
            const vi = { name: 'Họ tên', phone: 'Số điện thoại' };
            req.flash('error_msg', `File thiếu cột bắt buộc: ${hdr.missing.map(k => vi[k] || k).join(', ')}. Không đọc theo vị trí cột để tránh nhầm dữ liệu — tải file mẫu và điền đúng tiêu đề.`);
            return res.redirect('/admin/clients/list');
        }
        const col = hdr.map;
        const get = (row, key) => (col[key] != null ? cellText(row, col[key]) : '');

        const rows = [];
        ws.eachRow((row, idx) => { if (idx > hdr.headerRow) rows.push({ row, idx }); });
        const Branch = require('../../crm/models/branchModel.js');
        const seenPhones = new Set();
        for (const { row, idx } of rows) {
            const name = get(row, 'name');
            const phone = normalizePhone(get(row, 'phone'));
            const email = get(row, 'email');
            const branchName = get(row, 'branch');
            // dòng trống hoàn toàn → bỏ qua âm thầm (không tính là lỗi)
            if (!name && !phone && !email) continue;
            if (!name) { skipped++; skipReasons.push(`Dòng ${idx}: thiếu tên`); continue; }
            if (!phone) { skipped++; skipReasons.push(`Dòng ${idx}: thiếu SĐT`); continue; }
            if (!/^0\d{9}$/.test(phone)) { skipped++; skipReasons.push(`Dòng ${idx}: SĐT "${phone}" không hợp lệ (cần 10 số bắt đầu bằng 0)`); continue; }
            if (seenPhones.has(phone)) { skipped++; skipReasons.push(`Dòng ${idx}: SĐT ${phone} trùng với dòng khác trong file`); continue; }
            const cccd = normalizeCccd(get(row, 'cccd'));
            if (cccd && !/^\d{12}$/.test(cccd)) { skipped++; skipReasons.push(`Dòng ${idx}: CCCD "${cccd}" không hợp lệ (phải đủ 12 số)`); continue; }
            try {
                let branchId = req.session.user.branch;
                // Bảo mật (codex review 2): Manager không có chi nhánh → không import (fail-closed).
                if (req.session.user.role === 'Manager' && !branchId) { skipped++; skipReasons.push(`Dòng ${idx}: tài khoản Manager chưa gán chi nhánh`); continue; }
                if (branchName && req.session.user.role !== 'Manager') {
                    const b = await Branch.findOne({ name: new RegExp('^' + branchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }).select('_id').lean();
                    if (b) branchId = b._id;
                }
                let dob;
                const dobRaw = get(row, 'dob');
                if (dobRaw) {
                    const m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(dobRaw);
                    if (m) dob = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
                    else if (!Number.isNaN(new Date(dobRaw).getTime())) dob = new Date(dobRaw);
                }
                await exports._createClientFromImport({ name, phone, email: email || `import_${Date.now()}_${created}@fitcity.temp`, branch: branchId,
                    cccdNumber: cccd || undefined,
                    gender: get(row, 'gender') || undefined,
                    address: get(row, 'address') || undefined,
                    dob: dob || undefined });
                seenPhones.add(phone);
                created++;
            } catch (e) {
                skipped++;
                const m = e && e.message ? e.message : '';
                skipReasons.push(`Dòng ${idx}: ${/duplicate|E11000|trùng|exist/i.test(m) ? 'SĐT/email đã tồn tại trong hệ thống' : (m && m.length < 120 ? m : 'dữ liệu không hợp lệ')}`);
            }
        }
        try { fs.unlinkSync(path); } catch (_) {}
        // Rp15/8: phân biệt rõ 3 mức — thành công / một phần / thất bại hoàn toàn
        let level, msg;
        if (created > 0 && skipped === 0) { level = 'success_msg'; msg = `Import THÀNH CÔNG: tạo mới ${created} khách hàng.`; }
        else if (created > 0) { level = 'success_msg'; msg = `Import MỘT PHẦN: tạo mới ${created} khách hàng, bỏ qua ${skipped} dòng.`; }
        else { level = 'error_msg'; msg = `Import THẤT BẠI: không tạo được khách hàng nào (bỏ qua ${skipped} dòng).`; }
        if (skipReasons.length) msg += ' Chi tiết: ' + skipReasons.slice(0, 8).join('; ') + (skipReasons.length > 8 ? ` … (+${skipReasons.length - 8} dòng khác)` : '');
        req.flash(level, msg);
        res.redirect('/admin/clients/list');
    } catch (err) {
        req.flash('error_msg', 'Lỗi đọc file import: ' + err.message);
        res.redirect('/admin/clients/list');
    }
};

// Rp15/8 (158.xlsx ISSUE 3): file MẪU import chính thức — cột chuẩn, SĐT/CCCD định dạng TEXT, 2 dòng ví dụ.
exports.downloadImportTemplate = async (req, res, next) => {
    try {
        const ExcelJS = require('exceljs');
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Mau import KH');
        ws.columns = [
            { header: 'Họ tên', key: 'name', width: 24 },
            { header: 'Số điện thoại', key: 'phone', width: 16 },
            { header: 'Email', key: 'email', width: 26 },
            { header: 'Số CCCD', key: 'cccd', width: 18 },
            { header: 'Giới tính', key: 'gender', width: 10 },
            { header: 'Ngày sinh', key: 'dob', width: 14 },
            { header: 'Địa chỉ', key: 'address', width: 30 },
            { header: 'Chi nhánh', key: 'branch', width: 22 }
        ];
        ws.getRow(1).font = { bold: true };
        ws.getColumn('phone').numFmt = '@';
        ws.getColumn('cccd').numFmt = '@';
        ws.getColumn('dob').numFmt = '@';
        ws.addRow({ name: 'Nguyễn Văn A', phone: '0912345678', email: 'a@example.com', cccd: '079212345678', gender: 'Nam', dob: '15/08/1990', address: '12 Lê Lợi, Q1', branch: '' });
        ws.addRow({ name: 'Trần Thị B', phone: '0987654321', email: '', cccd: '', gender: 'Nữ', dob: '', address: '', branch: '' });
        const note = ws.addRow({ name: 'Ghi chú: giữ nguyên tiêu đề cột; SĐT 10 số bắt đầu bằng 0; xoá 2 dòng ví dụ trước khi import.' });
        note.font = { italic: true, color: { argb: 'FF64748B' } };
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Mau_import_khach_hang.xlsx"');
        await wb.xlsx.write(res);
        res.end();
    } catch (err) { next(err); }
};

exports._createClientFromImport = async (data) => {
    const clientManagementService = require('../services/clientManagementService');
    const crypto = require('crypto');
    return clientManagementService.createClient({
        ...data,
        password: crypto.randomBytes(5).toString('hex'),
        status: 'Active'
    });
};
