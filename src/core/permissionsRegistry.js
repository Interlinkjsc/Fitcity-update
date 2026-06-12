/**
 * Danh mục quyền hạn hệ thống — nguồn sự thật cho SA phân quyền & gợi ý theo role.
 * Mỗi quyền: resource + action (khớp checkPermission).
 */

const ASSIGNABLE_ROLES = [
    'Admin',
    'CEO',
    'Manager',
    'PT',
    'Accountant',
    'Marketing',
    'Sales',
    'Client'
];

const ROLE_LABELS = {
    SA: 'Super Admin',
    Admin: 'Quản trị viên',
    CEO: 'Giám đốc điều hành',
    Client: 'Khách hàng',
    Manager: 'Quản lý chi nhánh',
    PT: 'Huấn luyện viên',
    Accountant: 'Kế toán',
    Marketing: 'Marketing',
    Sales: 'Kinh doanh',
    Client: 'Khách hàng'
};

/** @type {Array<{ id: string, resource: string, action: string, label: string, group: string, description?: string, suggestedRoles: string[], menuKey?: string }>} */
const PERMISSIONS = [
    // Hệ thống
    { id: 'role_permissions.manage', resource: 'role_permissions', action: 'manage', label: 'Quản lý phân quyền', group: 'Hệ thống', description: 'Chỉ SA', suggestedRoles: [] },
    { id: 'system_settings.view', resource: 'system_settings', action: 'view', label: 'Xem cài đặt hệ thống', group: 'Hệ thống', suggestedRoles: ['Admin', 'CEO'], menuKey: 'settings' },
    { id: 'system_settings.update', resource: 'system_settings', action: 'update', label: 'Cập nhật cài đặt (VAT…)', group: 'Hệ thống', suggestedRoles: ['Admin', 'CEO'] },
    { id: 'checklist.view', resource: 'checklist', action: 'view', label: 'Xem checklist công việc', group: 'Hệ thống', suggestedRoles: ['Admin', 'CEO', 'Manager'], menuKey: 'checklists' },
    { id: 'checklist.manage', resource: 'checklist', action: 'manage', label: 'Quản lý checklist', group: 'Hệ thống', suggestedRoles: ['Admin', 'CEO', 'Manager'] },
    { id: 'daily_report.view', resource: 'daily_report', action: 'view', label: 'Xem daily report', group: 'Vận hành', suggestedRoles: ['Admin', 'CEO', 'Manager'], menuKey: 'daily-reports' },
    { id: 'daily_report.submit', resource: 'daily_report', action: 'submit', label: 'Nộp daily report', group: 'Vận hành', suggestedRoles: ['PT', 'Sales', 'Manager', 'Marketing'] },
    { id: 'daily_report.manage', resource: 'daily_report', action: 'manage', label: 'Duyệt daily report', group: 'Vận hành', suggestedRoles: ['Admin', 'Manager', 'CEO'] },
    { id: 'pt_leave.view', resource: 'pt_leave', action: 'view', label: 'Xem PT nghỉ giữa kỳ', group: 'Vận hành PT', suggestedRoles: ['Admin', 'Manager'], menuKey: 'pt-leave' },
    { id: 'pt_leave.manage', resource: 'pt_leave', action: 'manage', label: 'Duyệt PT nghỉ & reassign HĐ', group: 'Vận hành PT', suggestedRoles: ['Admin', 'Manager'] },
    { id: 'job_description.view', resource: 'job_description', action: 'view', label: 'Xem mô tả công việc (JD)', group: 'Hệ thống', suggestedRoles: ['Admin'] },
    { id: 'job_description.manage', resource: 'job_description', action: 'manage', label: 'Quản lý JD', group: 'Hệ thống', suggestedRoles: ['Admin'] },

    // Tổ chức
    { id: 'user_management.view', resource: 'user_management', action: 'view', label: 'Xem chi nhánh (quản trị)', group: 'Tổ chức', suggestedRoles: ['Admin', 'CEO'], menuKey: 'branches' },
    { id: 'user_management.create', resource: 'user_management', action: 'create', label: 'Tạo chi nhánh', group: 'Tổ chức', suggestedRoles: ['Admin', 'SA'] },
    { id: 'user_management.manage', resource: 'user_management', action: 'manage', label: 'Sửa chi nhánh', group: 'Tổ chức', suggestedRoles: ['Admin', 'SA'] },
    { id: 'user_management.delete', resource: 'user_management', action: 'delete', label: 'Xóa chi nhánh', group: 'Tổ chức', suggestedRoles: ['Admin', 'SA'] },
    { id: 'branch_dashboard.view', resource: 'branch_dashboard', action: 'view', label: 'Dashboard chi nhánh', group: 'Tổ chức', suggestedRoles: ['CEO', 'Manager', 'Admin'], menuKey: 'branches' },
    { id: 'staff_management.view', resource: 'staff_management', action: 'view', label: 'Xem nhân sự / KH admin', group: 'Tổ chức', suggestedRoles: ['Admin', 'Manager'], menuKey: 'users' },
    { id: 'staff_management.create', resource: 'staff_management', action: 'create', label: 'Tạo nhân sự / KH', group: 'Tổ chức', suggestedRoles: ['Admin', 'Manager'] },
    { id: 'staff_management.update', resource: 'staff_management', action: 'update', label: 'Sửa nhân sự / KH', group: 'Tổ chức', suggestedRoles: ['Admin', 'Manager'] },
    { id: 'staff_management.manage', resource: 'staff_management', action: 'manage', label: 'Quản lý nhân sự (nâng cao)', group: 'Tổ chức', suggestedRoles: ['Admin'] },
    { id: 'staff_management.delete', resource: 'staff_management', action: 'delete', label: 'Xóa nhân sự / KH', group: 'Tổ chức', suggestedRoles: ['Admin'] },

    // CRM
    { id: 'leads.view', resource: 'leads', action: 'view', label: 'Xem leads', group: 'CRM & Marketing', suggestedRoles: ['Admin', 'Manager', 'Marketing'], menuKey: 'leads' },
    { id: 'leads.manage', resource: 'leads', action: 'manage', label: 'Quản lý leads', group: 'CRM & Marketing', suggestedRoles: ['Admin', 'Manager', 'Marketing'] },
    { id: 'cms.view', resource: 'cms', action: 'view', label: 'Xem CMS website', group: 'CRM & Marketing', suggestedRoles: ['Admin', 'Manager', 'Marketing'], menuKey: 'cms' },
    { id: 'cms.manage', resource: 'cms', action: 'manage', label: 'Quản lý CMS', group: 'CRM & Marketing', suggestedRoles: ['Admin', 'Marketing'] },
    { id: 'content_library.view', resource: 'content_library', action: 'view', label: 'Xem kho nội dung', group: 'CRM & Marketing', suggestedRoles: ['Admin', 'Marketing'], menuKey: 'content_library' },
    { id: 'content_library.manage', resource: 'content_library', action: 'manage', label: 'Quản lý kho nội dung', group: 'CRM & Marketing', suggestedRoles: ['Admin', 'Marketing'] },
    { id: 'violations.view', resource: 'violations', action: 'view', label: 'Xem kỷ luật', group: 'CRM & Marketing', suggestedRoles: ['Admin', 'Manager', 'CEO'], menuKey: 'violations' },
    { id: 'violations.manage', resource: 'violations', action: 'manage', label: 'Quản lý kỷ luật', group: 'CRM & Marketing', suggestedRoles: ['Admin', 'Manager'] },
    { id: 'pt_change.view', resource: 'pt_change', action: 'view', label: 'Xem yêu cầu đổi PT', group: 'Vận hành PT', suggestedRoles: ['Admin', 'Manager'], menuKey: 'pt-change' },
    { id: 'pt_change.manage', resource: 'pt_change', action: 'manage', label: 'Duyệt đổi PT', group: 'Vận hành PT', suggestedRoles: ['Admin', 'Manager'] },
    { id: 'slots.view', resource: 'slots', action: 'view', label: 'Xem lịch tập', group: 'Vận hành PT', suggestedRoles: ['Admin', 'Manager', 'CEO'], menuKey: 'slots' },
    { id: 'slots.manage', resource: 'slots', action: 'manage', label: 'Quản lý lịch tập', group: 'Vận hành PT', suggestedRoles: ['Admin', 'Manager'] },

    // Hợp đồng
    { id: 'contract.view', resource: 'contract', action: 'view', label: 'Xem hợp đồng', group: 'Hợp đồng & Doanh thu', suggestedRoles: ['Admin', 'CEO', 'Manager', 'Accountant', 'Sales', 'PT', 'Client'], menuKey: 'contracts' },
    { id: 'contract.create', resource: 'contract', action: 'create', label: 'Tạo hợp đồng', group: 'Hợp đồng & Doanh thu', suggestedRoles: ['PT', 'Sales', 'Admin', 'Manager'] },
    { id: 'contract.manage', resource: 'contract', action: 'manage', label: 'Quản lý HĐ (sửa, TT, bảo lưu)', group: 'Hợp đồng & Doanh thu', suggestedRoles: ['Admin', 'Accountant', 'Manager'] },
    { id: 'contract.delete', resource: 'contract', action: 'delete', label: 'Xóa hợp đồng', group: 'Hợp đồng & Doanh thu', suggestedRoles: ['Admin'] },

    // Tài chính
    { id: 'timesheet.view', resource: 'timesheet', action: 'view', label: 'Xem chấm công', group: 'Vận hành PT', suggestedRoles: ['Admin', 'CEO', 'Manager', 'Accountant', 'PT'], menuKey: 'timesheets' },
    { id: 'timesheet.manage', resource: 'timesheet', action: 'manage', label: 'Duyệt chấm công', group: 'Vận hành PT', suggestedRoles: ['Admin', 'Manager'] },
    { id: 'payroll.view', resource: 'payroll', action: 'view', label: 'Xem bảng lương', group: 'Tài chính', suggestedRoles: ['Admin', 'Accountant'], menuKey: 'payroll' },
    { id: 'payroll.manage', resource: 'payroll', action: 'manage', label: 'Duyệt / thanh toán lương', group: 'Tài chính', suggestedRoles: ['Admin'] },
    { id: 'expenses.view', resource: 'expenses', action: 'view', label: 'Xem sổ chi', group: 'Tài chính', suggestedRoles: ['Admin', 'Manager', 'Accountant'], menuKey: 'expenses' },
    { id: 'expenses.manage', resource: 'expenses', action: 'manage', label: 'Ghi / sửa chi phí', group: 'Tài chính', suggestedRoles: ['Admin', 'Manager'] },
    { id: 'expenses.delete', resource: 'expenses', action: 'delete', label: 'Xóa khoản chi', group: 'Tài chính', suggestedRoles: ['Admin'] },
    { id: 'coupons.view', resource: 'coupons', action: 'view', label: 'Xem khuyến mãi', group: 'Tài chính', suggestedRoles: ['Sales', 'Manager', 'Admin'], menuKey: 'coupons' },
    { id: 'coupons.manage', resource: 'coupons', action: 'manage', label: 'Tạo / gán coupon', group: 'Tài chính', suggestedRoles: ['Sales', 'Manager', 'Admin'] },
    { id: 'coupons.delete', resource: 'coupons', action: 'delete', label: 'Xóa coupon', group: 'Tài chính', suggestedRoles: ['Admin'] },

    // Chương trình
    { id: 'packages.view', resource: 'packages', action: 'view', label: 'Xem gói tập', group: 'Chương trình', suggestedRoles: ['Admin', 'Manager'], menuKey: 'packages' },
    { id: 'packages.manage', resource: 'packages', action: 'manage', label: 'Quản lý gói tập', group: 'Chương trình', suggestedRoles: ['Admin'] },
    { id: 'rewards.view', resource: 'rewards', action: 'view', label: 'Xem phần thưởng', group: 'Chương trình', suggestedRoles: ['Admin', 'Manager'] },
    { id: 'rewards.manage', resource: 'rewards', action: 'manage', label: 'Quản lý phần thưởng', group: 'Chương trình', suggestedRoles: ['Admin', 'Manager'] },
    { id: 'rewards.delete', resource: 'rewards', action: 'delete', label: 'Xóa phần thưởng', group: 'Chương trình', suggestedRoles: ['Admin'] },
    { id: 'kpi.view', resource: 'kpi', action: 'view', label: 'Xem thiết lập KPI', group: 'Chương trình', suggestedRoles: ['Admin', 'CEO'], menuKey: 'kpi' },
    { id: 'kpi.manage', resource: 'kpi', action: 'manage', label: 'Cài đặt KPI', group: 'Chương trình', suggestedRoles: ['Admin', 'CEO'] },
    { id: 'meal_plan.view', resource: 'meal_plan', action: 'view', label: 'Xem meal plan', group: 'Chương trình', suggestedRoles: ['PT', 'Manager', 'Client'] },
    { id: 'meal_plan.create', resource: 'meal_plan', action: 'create', label: 'Tạo meal plan', group: 'Chương trình', suggestedRoles: ['PT'] },
    { id: 'pt_session.view', resource: 'pt_session', action: 'view', label: 'Xem buổi tập', group: 'Vận hành PT', suggestedRoles: ['PT', 'Manager', 'Client'] },
    { id: 'pt_session.update', resource: 'pt_session', action: 'update', label: 'Cập nhật buổi tập', group: 'Vận hành PT', suggestedRoles: ['PT'] },
    { id: 'session_approval.view', resource: 'session_approval', action: 'view', label: 'Xem lịch tập chờ duyệt', group: 'Vận hành PT', suggestedRoles: ['Admin', 'Manager', 'SA'], menuKey: 'session-approval' },
    { id: 'session_approval.manage', resource: 'session_approval', action: 'manage', label: 'Duyệt / từ chối lịch tập', group: 'Vận hành PT', suggestedRoles: ['Admin', 'Manager', 'SA'] },
    { id: 'meal_plan_approval.view', resource: 'meal_plan_approval', action: 'view', label: 'Xem kế hoạch dinh dưỡng chờ duyệt', group: 'Chương trình', suggestedRoles: ['Admin', 'Manager', 'SA'], menuKey: 'meal-plan-approval' },
    { id: 'meal_plan_approval.manage', resource: 'meal_plan_approval', action: 'manage', label: 'Duyệt / từ chối kế hoạch dinh dưỡng', group: 'Chương trình', suggestedRoles: ['Admin', 'Manager', 'SA'] },

    // Dashboard (menu — một số route dùng restrictTo riêng)
    { id: 'dashboard.view', resource: 'dashboard', action: 'view', label: 'Bảng điều khiển admin', group: 'Truy cập', suggestedRoles: ['Admin', 'CEO', 'Manager', 'Accountant', 'Sales', 'Marketing'], menuKey: 'dashboard' },
    { id: 'export_report.view', resource: 'export_report', action: 'view', label: 'Xuất báo cáo', group: 'Truy cập', suggestedRoles: ['Admin', 'CEO'] }
];

const PERMISSION_BY_ID = Object.fromEntries(PERMISSIONS.map((p) => [p.id, p]));

function permissionId(resource, action) {
    return `${resource}.${action}`;
}

function getSuggestedPermissionIds(role) {
    return PERMISSIONS.filter((p) => p.suggestedRoles.includes(role)).map((p) => p.id);
}

function getPermissionsGrouped() {
    const groups = {};
    for (const p of PERMISSIONS) {
        if (!groups[p.group]) groups[p.group] = [];
        groups[p.group].push(p);
    }
    return groups;
}

/** Ma trận resource → action → roles[] (tương thích authMiddleware cũ) */
function buildMatrixFromRolePermissions(roleToPermissionIds) {
    const matrix = {};
    for (const [role, ids] of Object.entries(roleToPermissionIds)) {
        for (const id of ids) {
            const perm = PERMISSION_BY_ID[id];
            if (!perm) continue;
            if (!matrix[perm.resource]) matrix[perm.resource] = {};
            if (!matrix[perm.resource][perm.action]) matrix[perm.resource][perm.action] = [];
            if (!matrix[perm.resource][perm.action].includes(role)) {
                matrix[perm.resource][perm.action].push(role);
            }
        }
    }
    return matrix;
}

function buildDefaultRolePermissionMap() {
    const map = {};
    for (const role of ASSIGNABLE_ROLES) {
        map[role] = getSuggestedPermissionIds(role);
    }
    return map;
}

module.exports = {
    ASSIGNABLE_ROLES,
    ROLE_LABELS,
    PERMISSIONS,
    PERMISSION_BY_ID,
    permissionId,
    getSuggestedPermissionIds,
    getPermissionsGrouped,
    buildMatrixFromRolePermissions,
    buildDefaultRolePermissionMap
};
