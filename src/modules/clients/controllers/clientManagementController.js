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
        const { clients, pagination, query } = await clientManagementService.getClientList(req.query);

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

