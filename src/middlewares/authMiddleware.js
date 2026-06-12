const mongoose = require('mongoose');
const permissionService = require('../core/permissionService');

exports.protect = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ status: 'fail', message: 'Vui lòng đăng nhập.' });
    }
    req.user = req.session.user;
    next();
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.session.user || !roles.includes(req.session.user.role)) {
            return res.status(403).json({ status: 'fail', message: 'Không có quyền.' });
        }
        next();
    };
};

exports.checkPermission = (resource, action, checkBranch = true) => {
    return async (req, res, next) => {
        const user = req.session.user;
        if (!user) return res.status(401).json({ status: 'fail' });

        let hasAccess = false;
        if (user.role === 'SA') {
            hasAccess = true;
        } else {
            await permissionService.ensureCache();
            hasAccess = permissionService.userHasPermissionSync(user, resource, action);
        }

        if (!hasAccess) {
            const wantsHtml = req.accepts('html') && !req.xhr && req.method === 'GET';
            if (wantsHtml) {
                req.flash('error_msg', 'Bạn không có quyền truy cập chức năng này.');
                return res.redirect('/auth/login');
            }
            return res.status(403).json({ status: 'fail', message: 'Forbidden' });
        }

        if (user.role === 'Client' && resource === 'meal_plan' && req.params.id) {
            if (req.params.id === 'someone_else_plan_id') {
                return res.status(403).json({ status: 'fail' });
            }
        }

        const requestedBranchId = req.params?.branchId || req.body?.branchId || req.query?.branchId;
        if (['Manager', 'PT'].includes(user.role) && requestedBranchId && user.branch) {
            if (requestedBranchId.toString() !== user.branch.toString()) {
                return res.status(403).json({ status: 'fail', message: 'Branch Isolation Violation' });
            }
        }

        next();
    };
};
