const permissionService = require('../../../core/permissionService');
const registry = require('../../../core/permissionsRegistry');

exports.getPermissionManager = async (req, res, next) => {
    try {
        const selectedRole = req.query.role || registry.ASSIGNABLE_ROLES[0];
        const permissionGroups = registry.getPermissionsGrouped();
        const suggestedIds = registry.getSuggestedPermissionIds(selectedRole);
        const currentIds = await permissionService.getRolePermissionIds(selectedRole);
        const currentSet = new Set(currentIds);
        const suggestedByRole = Object.fromEntries(
            registry.ASSIGNABLE_ROLES.map((r) => [r, registry.getSuggestedPermissionIds(r)])
        );

        res.render('admin/permissions/index', {
            activePage: 'permissions',
            assignableRoles: registry.ASSIGNABLE_ROLES,
            roleLabels: registry.ROLE_LABELS,
            selectedRole,
            permissionGroups,
            suggestedIds,
            suggestedByRole,
            currentIds,
            allPermissionIds: registry.PERMISSIONS.map((p) => p.id),
            allPermissions: registry.PERMISSIONS
        });
    } catch (err) {
        next(err);
    }
};

exports.saveRolePermissions = async (req, res, next) => {
    try {
        const { role } = req.body;
        if (!registry.ASSIGNABLE_ROLES.includes(role)) {
            req.flash('error_msg', 'Vai trò không hợp lệ.');
            return res.redirect('/admin/permissions');
        }

        let permissionIds = req.body.permissionIds;
        if (!permissionIds) permissionIds = [];
        if (!Array.isArray(permissionIds)) permissionIds = [permissionIds];

        await permissionService.saveRolePermissions(role, permissionIds, req.session.user.id);
        req.flash('success_msg', `Đã lưu ${permissionIds.length} quyền cho vai trò ${registry.ROLE_LABELS[role] || role}.`);
        res.redirect(`/admin/permissions?role=${encodeURIComponent(role)}`);
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect(`/admin/permissions?role=${encodeURIComponent(req.body.role || '')}`);
    }
};

exports.resetToSuggested = async (req, res, next) => {
    try {
        const { role } = req.body;
        if (!registry.ASSIGNABLE_ROLES.includes(role)) {
            req.flash('error_msg', 'Vai trò không hợp lệ.');
            return res.redirect('/admin/permissions');
        }
        await permissionService.resetRoleToSuggested(role, req.session.user.id);
        req.flash('success_msg', `Đã khôi phục gợi ý mặc định cho ${registry.ROLE_LABELS[role] || role}.`);
        res.redirect(`/admin/permissions?role=${encodeURIComponent(role)}`);
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/permissions');
    }
};

/** API JSON — gợi ý theo role (cho Alpine / fetch) */
exports.getSuggestedApi = async (req, res) => {
    const role = req.query.role;
    if (!role) {
        return res.status(400).json({ status: 'fail', message: 'Thiếu role' });
    }
    const suggested = registry.getSuggestedPermissionIds(role);
    res.json({ status: 'success', role, suggested });
};
