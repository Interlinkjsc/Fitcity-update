const timesheetService = require('../services/timesheetService.js');
const Branch = require('../../crm/models/branchModel.js');
const User = require('../../users/models/userModel.js');

exports.getPtAttendancePage = async (req, res, next) => {
    try {
        const staffId = req.session.user.id;
        const summary = await timesheetService.getTodaySummary(staffId);
        const now = new Date();
        const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
        const year = parseInt(req.query.year, 10) || now.getFullYear();
        const monthEntries = await timesheetService.listForMonth({
            month,
            year,
            staffId
        });

        res.render('pt/attendance', {
            summary,
            monthEntries,
            month,
            year,
            user: req.session.user
        });
    } catch (err) {
        next(err);
    }
};

exports.ptCheckIn = async (req, res, next) => {
    try {
        const user = req.session.user;
        const branchId = user.branch || req.body.branchId;
        if (!branchId) {
            req.flash('error_msg', 'Tài khoản PT chưa gán chi nhánh.');
            return res.redirect('/pt/attendance');
        }
        await timesheetService.checkIn(user.id, branchId);
        req.flash('success_msg', 'Đã check-in ca dạy.');
        res.redirect('/pt/attendance');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/pt/attendance');
    }
};

exports.ptCheckOut = async (req, res, next) => {
    try {
        await timesheetService.checkOut(req.session.user.id);
        req.flash('success_msg', 'Đã check-out. Ca chờ Manager duyệt.');
        res.redirect('/pt/attendance');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/pt/attendance');
    }
};

exports.getAdminList = async (req, res, next) => {
    try {
        const now = new Date();
        const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
        const year = parseInt(req.query.year, 10) || now.getFullYear();
        const status = req.query.status || 'all';
        let branchId = req.query.branchId || 'all';

        if (req.session.user.role === 'Manager' && req.session.user.branch) {
            branchId = req.session.user.branch.toString();
        }

        const entries = await timesheetService.listForMonth({ month, year, branchId, status });
        const branches = await Branch.find({ status: 'Open' }).select('name').sort({ name: 1 });
        const staffList = await User.find({
            role: { $in: ['PT', 'Sales', 'Manager'] },
            status: 'Active',
            ...(branchId !== 'all' ? { branch: branchId } : {})
        })
            .select('name role')
            .sort({ name: 1 });

        res.render('admin/timesheets/list', {
            entries,
            branches,
            staffList,
            month,
            year,
            currentFilter: { status, branchId },
            isManager: req.session.user.role === 'Manager'
        });
    } catch (err) {
        next(err);
    }
};

exports.approve = async (req, res, next) => {
    try {
        await timesheetService.approve(req.params.id, req.session.user.id, req.body.note);
        req.flash('success_msg', 'Đã duyệt ca chấm công.');
        res.redirect(req.get('Referrer') || '/admin/timesheets');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect(req.get('Referrer') || '/admin/timesheets');
    }
};

exports.reject = async (req, res, next) => {
    try {
        await timesheetService.reject(req.params.id, req.session.user.id, req.body.note);
        req.flash('success_msg', 'Đã từ chối ca chấm công.');
        res.redirect(req.get('Referrer') || '/admin/timesheets');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/timesheets');
    }
};
