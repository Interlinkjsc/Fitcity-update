const Branch = require('../../crm/models/branchModel');
const User = require('../../users/models/userModel');
const dailyReportService = require('../services/dailyReportService');
const { getPagination } = require('../../../utils/paginationHelper');

const STAFF_ROLES = ['PT', 'Sales', 'Manager', 'Marketing'];

exports.getAdminList = async (req, res, next) => {
    try {
        const user = req.session.user;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 15;
        const skip = (page - 1) * limit;
        const now = new Date();
        const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
        const year = parseInt(req.query.year, 10) || now.getFullYear();

        const filter = dailyReportService.buildListFilter(user, {
            ...req.query,
            month,
            year
        });

        const [totalDocs, reports, branches, staff] = await Promise.all([
            require('../models/dailyReportModel').countDocuments(filter),
            dailyReportService.listReports(filter, { skip, limit }),
            Branch.find({ status: 'Open' }).select('name').sort({ name: 1 }),
            User.find({
                role: { $in: ['PT', 'Sales'] },
                status: 'Active',
                ...(user.role === 'Manager' && user.branch ? { branch: user.branch } : {})
            })
                .select('name role')
                .sort({ name: 1 })
        ]);

        res.render('admin/daily-reports/list', {
            reports,
            branches,
            staff,
            month,
            year,
            pagination: getPagination(totalDocs, page, limit),
            currentFilter: {
                status: req.query.status || 'all',
                branchId: req.query.branchId || 'all',
                authorId: req.query.authorId || 'all'
            },
            activePage: 'daily-reports'
        });
    } catch (err) {
        next(err);
    }
};

exports.getDetail = async (req, res, next) => {
    try {
        const DailyReport = require('../models/dailyReportModel.js');
        const report = await DailyReport.findById(req.params.id)
            .populate('author', 'name email role')
            .populate('branch', 'name')
            .populate('reviewedBy', 'name')
            .lean();
        if (!report) {
            req.flash('error_msg', 'Không tìm thấy báo cáo.');
            return res.redirect('/admin/daily-reports');
        }
        // Bảo mật (codex review 2): Manager chỉ xem báo cáo trong chi nhánh mình — fail-closed.
        if (req.session.user.role === 'Manager') {
            const myBranch = req.session.user.branch ? String(req.session.user.branch) : '';
            const reportBranch = report.branch && report.branch._id ? String(report.branch._id) : '';
            if (!myBranch || reportBranch !== myBranch) {
                req.flash('error_msg', 'Bạn không có quyền xem báo cáo của chi nhánh khác.');
                return res.redirect('/admin/daily-reports');
            }
        }
        res.render('admin/daily-reports/detail', { report, activePage: 'daily-reports' });
    } catch (err) { next(err); }
};

exports.getSubmitPage = async (req, res, next) => {
    try {
        const user = req.session.user;
        if (!STAFF_ROLES.includes(user.role) && user.role !== 'Accountant') {
            req.flash('error_msg', 'Vai trò không được nộp daily report tại đây.');
            return res.redirect('/admin');
        }
        if (!user.branch) {
            req.flash('error_msg', 'Tài khoản chưa gán chi nhánh.');
            return res.redirect('/admin');
        }

        const now = new Date();
        const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
        const year = parseInt(req.query.year, 10) || now.getFullYear();
        const { start, end } = dailyReportService.monthRange(month, year);

        const myReports = await dailyReportService.listReports({
            author: user.id,
            reportDate: { $gte: start, $lte: end }
        });

        const layout = user.role === 'PT' ? 'pt/daily-report' : 'admin/daily-reports/submit';
        res.render(layout, {
            myReports,
            month,
            year,
            user,
            today: new Date().toISOString().split('T')[0],
            activePage: user.role === 'PT' ? 'daily-report' : 'daily-reports'
        });
    } catch (err) {
        next(err);
    }
};

exports.submit = async (req, res, next) => {
    try {
        const user = req.session.user;
        if (!user.branch) {
            req.flash('error_msg', 'Tài khoản chưa gán chi nhánh.');
            return res.redirect(user.role === 'PT' ? '/pt/daily-report' : '/admin/daily-reports/submit');
        }

        const { summary, accomplishments, blockers, reportDate } = req.body;
        if (!summary?.trim()) {
            req.flash('error_msg', 'Vui lòng nhập tóm tắt công việc.');
            return res.redirect(user.role === 'PT' ? '/pt/daily-report' : '/admin/daily-reports/submit');
        }

        await dailyReportService.submitReport(user.id, user.branch, {
            summary: summary.trim(),
            accomplishments,
            blockers,
            reportDate
        });

        req.flash('success_msg', 'Đã nộp daily report. Chờ Manager duyệt.');
        const redirect =
            user.role === 'PT' ? '/pt/daily-report' : '/admin/daily-reports/submit';
        res.redirect(redirect);
    } catch (err) {
        req.flash('error_msg', err.message);
        const redirect =
            req.session.user.role === 'PT' ? '/pt/daily-report' : '/admin/daily-reports/submit';
        res.redirect(redirect);
    }
};

exports.approve = async (req, res, next) => {
    try {
        await dailyReportService.approve(req.params.id, req.session.user.id, req.body.note);
        req.flash('success_msg', 'Đã duyệt daily report.');
        res.redirect(req.get('Referrer') || '/admin/daily-reports');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/daily-reports');
    }
};

exports.reject = async (req, res, next) => {
    try {
        await dailyReportService.reject(req.params.id, req.session.user.id, req.body.note);
        req.flash('success_msg', 'Đã từ chối daily report.');
        res.redirect(req.get('Referrer') || '/admin/daily-reports');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/daily-reports');
    }
};
