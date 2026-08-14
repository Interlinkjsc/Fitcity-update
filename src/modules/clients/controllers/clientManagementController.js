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
        let created = 0, skipped = 0;
        const skipReasons = [];

        // Rp27/7 A3: chuẩn hoá cell + khôi phục số 0 đầu SĐT/CCCD (xem src/utils/importNormalize.js)
        const { cellText, normalizePhone, normalizeCccd } = require('../../../utils/importNormalize');

        const rows = [];
        ws.eachRow((row, idx) => { if (idx > 1) rows.push({ row, idx }); });
        for (const { row, idx } of rows) {
            const name = cellText(row, 1);
            const phone = normalizePhone(cellText(row, 2));
            let email = cellText(row, 3);
            const branchName = cellText(row, 8);
            if (!name) { skipped++; skipReasons.push(`Dòng ${idx}: thiếu tên`); continue; }
            if (!phone) { skipped++; skipReasons.push(`Dòng ${idx}: thiếu SĐT`); continue; }
            if (!/^0\d{9}$/.test(phone)) { skipped++; skipReasons.push(`Dòng ${idx}: SĐT "${phone}" không hợp lệ (cần 10 số bắt đầu bằng 0)`); continue; }
            const cccd = normalizeCccd(cellText(row, 4));
            if (cccd && !/^\d{12}$/.test(cccd)) { skipped++; skipReasons.push(`Dòng ${idx}: CCCD "${cccd}" không hợp lệ (phải đủ 12 số)`); continue; }
            try {
                const Branch = require('../../crm/models/branchModel.js');
                let branchId = req.session.user.branch;
                // Bảo mật (codex review 2): Manager không có chi nhánh → không import (fail-closed).
                if (req.session.user.role === 'Manager' && !branchId) { skipped++; skipReasons.push(`Dòng ${idx}: tài khoản Manager chưa gán chi nhánh`); continue; }
                if (branchName && req.session.user.role !== 'Manager') {
                    const b = await Branch.findOne({ name: new RegExp('^' + branchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }).select('_id').lean();
                    if (b) branchId = b._id;
                }
                await exports._createClientFromImport({ name, phone, email: email || `import_${Date.now()}_${created}@fitcity.temp`, branch: branchId,
                    cccdNumber: cccd || undefined,
                    gender: cellText(row, 5) || undefined,
                    address: cellText(row, 7) || undefined });
                created++;
            } catch (e) {
                skipped++;
                skipReasons.push(`Dòng ${idx}: ${e.message && e.message.length < 120 ? e.message : 'trùng SĐT/email hoặc dữ liệu không hợp lệ'}`);
            }
        }
        try { fs.unlinkSync(path); } catch (_) {}
        let msg = `Import hoàn tất: tạo mới ${created} khách hàng, bỏ qua ${skipped} dòng.`;
        if (skipReasons.length) msg += ' Chi tiết: ' + skipReasons.slice(0, 8).join('; ') + (skipReasons.length > 8 ? ` … (+${skipReasons.length - 8} dòng khác)` : '');
        req.flash(created > 0 ? 'success_msg' : 'error_msg', msg);
        res.redirect('/admin/clients/list');
    } catch (err) {
        req.flash('error_msg', 'Lỗi đọc file import: ' + err.message);
        res.redirect('/admin/clients/list');
    }
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
