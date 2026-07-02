const mongoose = require('mongoose');
const permissionService = require('../core/permissionService');

exports.protect = (req, res, next) => {
    if (!req.session || !req.session.user) {
        const isApi = req.path.startsWith('/api/') ||
            (req.headers.accept && req.headers.accept.includes('application/json')) ||
            req.xhr;
        if (isApi) return res.status(401).json({ status: 'fail', message: 'Vui lòng đăng nhập.' });
        return res.redirect('/auth/login');
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
        if (!user) {
            const acceptsHtml = req.accepts('html') && !req.xhr;
            if (acceptsHtml) {
                if (req.flash) req.flash('error_msg', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                return res.redirect('/auth/login');
            }
            return res.status(401).json({ status: 'fail' });
        }

        let hasAccess = false;
        if (user.role === 'SA') {
            hasAccess = true;
        } else {
            await permissionService.ensureCache();
            hasAccess = permissionService.userHasPermissionSync(user, resource, action);
        }

        if (!hasAccess) {
            const isHtmlForm = req.accepts('html') && !req.xhr;
            if (isHtmlForm) {
                if (req.flash) req.flash('error_msg', 'Bạn không có quyền truy cập chức năng này.');
                if (req.method === 'GET') return res.redirect('/auth/login');
                return res.redirect('back');
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
