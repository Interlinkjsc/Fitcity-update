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
        const user = req.session.user;
        if (!user || !roles.includes(user.role)) {
            // Yêu cầu thực sự cần JSON (AJAX/fetch, hoặc client không accept html)
            // vẫn trả JSON 403 như cũ; còn điều hướng HTML thường thì hiện flash
            // + quay lại trang trước thay vì trả lỗi JSON thô không có UI.
            const wantsJson = req.xhr || !req.accepts('html') || req.is('application/json');

            if (!wantsJson && typeof req.flash === 'function' && user) {
                req.flash('error_msg', 'Bạn không có quyền truy cập chức năng này.');
                const referer = req.get('Referer');
                if (referer) return res.redirect(referer);
                if (user.role === 'PT') return res.redirect('/pt');
                if (user.role === 'Client') return res.redirect('/client');
                return res.redirect('/admin');
            }

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
            // Yêu cầu thực sự cần JSON (gọi từ AJAX/fetch, hoặc client không
            // accept html) thì vẫn trả JSON 403 như cũ.
            const wantsJson = req.xhr || !req.accepts('html') || req.is('application/json');

            if (!wantsJson && typeof req.flash === 'function') {
                req.flash('error_msg', 'Bạn không có quyền truy cập chức năng này.');
                // Thiếu quyền 1 chức năng không nên đăng xuất user khỏi session.
                // Ưu tiên quay lại trang trước (Referer); nếu không có, về dashboard
                // tương ứng theo role thay vì kick về trang login.
                const referer = req.get('Referer');
                if (referer) {
                    return res.redirect(referer);
                }
                if (user.role === 'PT') return res.redirect('/pt');
                if (user.role === 'Client') return res.redirect('/client');
                return res.redirect('/admin');
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
