const Branch = require('../../crm/models/branchModel');
const User = require('../../users/models/userModel');
const PTLeaveRequest = require('../models/ptLeaveRequestModel');
const ptLeaveService = require('../services/ptLeaveService');

exports.getPtLeavePage = async (req, res, next) => {
    try {
        const user = req.session.user;
        const requests = await PTLeaveRequest.find({ pt: user.id })
            .sort({ createdAt: -1 })
            .limit(20);
        res.render('pt/leave', { requests, user });
    } catch (err) {
        next(err);
    }
};

exports.submitLeave = async (req, res, next) => {
    try {
        const user = req.session.user;
        if (!user.branch) {
            req.flash('error_msg', 'Tài khoản chưa gán chi nhánh.');
            return res.redirect('/pt/leave');
        }
        await ptLeaveService.createLeaveRequest(user.id, user.branch, req.body);
        req.flash('success_msg', 'Đã gửi yêu cầu nghỉ. Manager sẽ xử lý và gán PT thay thế.');
        res.redirect('/pt/leave');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/pt/leave');
    }
};

exports.getAdminList = async (req, res, next) => {
    try {
        const user = req.session.user;
        const filter = {};
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }
        if (user.role === 'Manager' && user.branch) {
            filter.branch = user.branch;
        } else if (req.query.branchId && req.query.branchId !== 'all') {
            filter.branch = req.query.branchId;
        }

        const requests = await PTLeaveRequest.find(filter)
            .populate('pt', 'name email')
            .populate('branch', 'name')
            .populate('replacementPt', 'name')
            .sort({ createdAt: -1 });

        const branches = await Branch.find({ status: 'Open' }).select('name').sort({ name: 1 });
        const branchForPts =
            user.role === 'Manager' && user.branch ? user.branch : req.query.branchId;
        const pts = await User.find({
            role: 'PT',
            status: 'Active',
            ...(branchForPts && branchForPts !== 'all' ? { branch: branchForPts } : {})
        })
            .select('name branch')
            .sort({ name: 1 });

        res.render('admin/pt-leave/list', {
            requests,
            branches,
            pts,
            currentFilter: { status: req.query.status || 'all', branchId: req.query.branchId || 'all' },
            activePage: 'pt-leave'
        });
    } catch (err) {
        next(err);
    }
};

exports.approve = async (req, res, next) => {
    try {
        await ptLeaveService.approveWithReassign(req.params.id, req.session.user.id, {
            replacementPtId: req.body.replacementPtId,
            managerNote: req.body.managerNote
        });
        req.flash('success_msg', 'Đã duyệt nghỉ và chuyển HĐ sang PT thay thế.');
        res.redirect('/admin/pt-leave-requests');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/pt-leave-requests');
    }
};

exports.reject = async (req, res, next) => {
    try {
        await ptLeaveService.reject(req.params.id, req.session.user.id, req.body.managerNote);
        req.flash('success_msg', 'Đã từ chối yêu cầu nghỉ.');
        res.redirect('/admin/pt-leave-requests');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/pt-leave-requests');
    }
};
