/**
 * Sidebar menu — single source of truth for admin navigation.
 * moduleId aligns with docs/uml/use-cases/12-sa-standalone.puml (7 packages).
 */

const permissionService = require('../core/permissionService');
const registry = require('../core/permissionsRegistry');

const MENU_KEY_PERMISSIONS = {};
for (const p of registry.PERMISSIONS) {
    if (p.menuKey && !MENU_KEY_PERMISSIONS[p.menuKey]) {
        MENU_KEY_PERMISSIONS[p.menuKey] = { resource: p.resource, action: p.action };
    }
}

const MODULE_LABELS = {
    dashboard: null,
    platform: 'Hệ thống & Thiết lập',
    organization: 'Tổ chức & Nhân sự',
    crm: 'CRM & Marketing',
    clients: 'Khách hàng & Hợp đồng',
    finance: 'Tài chính & KPI',
    pt_ops: 'Vận hành PT',
    programs: 'Chương trình & Gói tập',
    website: 'Website & CMS',
};

/** @type {Record<string, { icon: string, collapsible: boolean }>} */
const MODULE_META = {
    dashboard: { icon: 'dashboard', collapsible: false },
    platform: { icon: 'tune', collapsible: true },
    organization: { icon: 'corporate_fare', collapsible: true },
    crm: { icon: 'campaign', collapsible: true },
    clients: { icon: 'handshake', collapsible: true },
    finance: { icon: 'account_balance', collapsible: true },
    pt_ops: { icon: 'fitness_center', collapsible: true },
    programs: { icon: 'category', collapsible: true },
    website: { icon: 'language', collapsible: true },
};

const STORAGE_KEY_MODULES = 'fitcity_sidebar_modules';

const MENU_ITEMS = [
    {
        key: 'dashboard',
        moduleId: 'dashboard',
        label: 'Bảng điều khiển',
        href: '/admin',
        icon: 'dashboard',
        permission: { resource: 'dashboard', action: 'view' },
        roles: ['Admin', 'Manager', 'SA', 'CEO', 'Accountant', 'Sales', 'Marketing'],
    },
    {
        key: 'permissions',
        moduleId: 'platform',
        label: 'Phân quyền',
        href: '/admin/permissions',
        icon: 'lock',
        permission: { resource: 'role_permissions', action: 'manage' },
        roles: ['SA'],
    },
    {
        key: 'settings',
        moduleId: 'platform',
        label: 'Cài đặt hệ thống',
        href: '/admin/settings',
        icon: 'settings',
        permission: { resource: 'system_settings', action: 'view' },
        roles: ['SA', 'Admin', 'CEO'],
    },
    {
        key: 'checklists',
        moduleId: 'platform',
        label: 'Checklist công việc',
        href: '/admin/checklists',
        icon: 'checklist',
        permission: { resource: 'checklist', action: 'view' },
        roles: ['SA', 'Admin', 'CEO', 'Manager'],
    },
    {
        key: 'daily-reports',
        moduleId: 'platform',
        label: 'Daily Report',
        href: '/admin/daily-reports',
        icon: 'assignment',
        permission: { resource: 'daily_report', action: 'view' },
        roles: ['SA', 'Admin', 'CEO', 'Manager'],
    },
    {
        key: 'job-descriptions',
        moduleId: 'platform',
        label: 'Mô tả công việc (JD)',
        href: '/admin/job-descriptions',
        icon: 'work',
        permission: { resource: 'job_description', action: 'view' },
        roles: ['SA', 'Admin'],
    },
    {
        key: 'export-report',
        moduleId: 'platform',
        label: 'Xuất báo cáo tài chính',
        href: '/admin/export-report',
        icon: 'download',
        permission: { resource: 'export_report', action: 'view' },
        roles: ['SA', 'Admin', 'CEO'],
    },
    {
        key: 'export-work-report',
        moduleId: 'platform',
        label: 'Xuất báo cáo công việc',
        href: '/admin/export-work-report',
        icon: 'table_chart',
        roles: ['SA', 'Admin', 'CEO', 'Manager'],
    },
    {
        key: 'branches',
        moduleId: 'organization',
        label: 'Quản lý Chi nhánh',
        href: '/admin/branches/list',
        icon: 'home_work',
        permissions: [
            { resource: 'user_management', action: 'view' },
            { resource: 'branch_dashboard', action: 'view' },
        ],
        roles: ['CEO', 'Manager', 'Admin', 'SA'],
    },
    {
        key: 'users',
        moduleId: 'organization',
        label: 'Quản lý Nhân sự',
        href: '/admin/users/list',
        icon: 'group',
        permission: { resource: 'staff_management', action: 'view' },
        roles: ['Admin', 'Manager', 'SA'],
    },
    {
        key: 'violations',
        moduleId: 'organization',
        label: 'Quản lý Kỷ luật',
        href: '/admin/violations',
        icon: 'warning',
        permission: { resource: 'violations', action: 'view' },
        roles: ['Admin', 'Manager', 'SA', 'CEO'],
    },
    {
        key: 'leads',
        moduleId: 'crm',
        label: 'Quản lý Leads',
        href: '/admin/leads',
        icon: 'person_search',
        permission: { resource: 'leads', action: 'view' },
        roles: ['Admin', 'Manager', 'SA', 'Marketing'],
    },
    {
        key: 'cms',
        moduleId: 'crm',
        label: 'CMS Website',
        href: '/admin/cms',
        icon: 'article',
        permission: { resource: 'cms', action: 'view' },
        roles: ['Admin', 'Manager', 'SA', 'Marketing'],
    },
    {
        key: 'content_library',
        moduleId: 'crm',
        label: 'Kho nội dung',
        href: '/admin/content-library',
        icon: 'perm_media',
        permission: { resource: 'content_library', action: 'view' },
        roles: ['Admin', 'Marketing', 'SA'],
    },
    {
        key: 'clients',
        moduleId: 'clients',
        label: 'Quản lý Khách hàng',
        href: '/admin/clients/list',
        icon: 'people',
        permission: { resource: 'staff_management', action: 'view' },
        roles: ['Admin', 'Manager', 'SA'],
    },
    {
        key: 'contracts',
        moduleId: 'clients',
        label: 'Hợp đồng & Doanh thu',
        href: '/admin/contracts/list',
        icon: 'description',
        permission: { resource: 'contract', action: 'view' },
        roles: ['Admin', 'CEO', 'Manager', 'Accountant', 'Sales', 'SA', 'PT', 'Client'],
    },
    {
        key: 'payroll',
        moduleId: 'finance',
        label: 'Lương & Thưởng',
        href: '/admin/payroll/summary',
        icon: 'payments',
        permission: { resource: 'payroll', action: 'view' },
        roles: ['Admin', 'SA', 'Accountant'],
    },
    {
        key: 'expenses',
        moduleId: 'finance',
        label: 'Sổ chi nội bộ',
        href: '/admin/expenses',
        icon: 'account_balance_wallet',
        permission: { resource: 'expenses', action: 'view' },
        roles: ['SA', 'Admin', 'Manager', 'Accountant'],
    },
    {
        key: 'coupons',
        moduleId: 'finance',
        label: 'Khuyến mãi',
        href: '/admin/coupons',
        icon: 'local_offer',
        permission: { resource: 'coupons', action: 'view' },
        roles: ['Sales', 'Manager', 'Admin', 'SA'],
    },
    {
        key: 'kpi',
        moduleId: 'finance',
        label: 'Thiết lập KPI',
        href: '/admin/kpi',
        icon: 'monitoring',
        permission: { resource: 'kpi', action: 'view' },
        roles: ['SA', 'Admin', 'CEO'],
    },
    {
        key: 'slots',
        moduleId: 'pt_ops',
        label: 'Quản lí lịch tập',
        href: '/admin/slots/calendar',
        icon: 'calendar_month',
        permission: { resource: 'slots', action: 'view' },
        roles: ['SA', 'Admin', 'Manager', 'CEO'],
    },
    {
        key: 'session-approval',
        moduleId: 'pt_ops',
        label: 'Lịch tập chờ duyệt',
        href: '/admin/sessions/pending',
        icon: 'pending_actions',
        permission: { resource: 'session_approval', action: 'view' },
        roles: ['SA', 'Admin', 'Manager'],
    },
    {
        key: 'timesheets',
        moduleId: 'pt_ops',
        label: 'Chấm công',
        href: '/admin/timesheets',
        icon: 'schedule',
        permission: { resource: 'timesheet', action: 'view' },
        roles: ['SA', 'Admin', 'CEO', 'Manager', 'Accountant'],
    },
    {
        key: 'pt-leave',
        moduleId: 'pt_ops',
        label: 'PT nghỉ giữa kỳ',
        href: '/admin/pt-leave-requests',
        icon: 'event_busy',
        permission: { resource: 'pt_leave', action: 'view' },
        roles: ['SA', 'Admin', 'Manager'],
    },
    {
        key: 'pt-change',
        moduleId: 'pt_ops',
        label: 'Yêu cầu đổi PT',
        href: '/admin/pt-change-requests',
        icon: 'swap_horiz',
        permission: { resource: 'pt_change', action: 'view' },
        roles: ['Admin', 'Manager', 'SA'],
    },
    {
        key: 'packages',
        moduleId: 'programs',
        label: 'Gói tập',
        href: '/admin/packages/list',
        icon: 'inventory_2',
        permission: { resource: 'packages', action: 'view' },
        roles: ['Admin', 'Manager', 'SA'],
    },
    {
        key: 'rewards',
        moduleId: 'programs',
        label: 'Phần thưởng',
        href: '/admin/rewards',
        icon: 'emoji_events',
        permission: { resource: 'rewards', action: 'view' },
        roles: ['Admin', 'Manager', 'SA'],
    },
    {
        key: 'meal-plan-approval',
        moduleId: 'programs',
        label: 'Dinh dưỡng chờ duyệt',
        href: '/admin/meal-plans/pending',
        icon: 'restaurant_menu',
        permission: { resource: 'meal_plan_approval', action: 'view' },
        roles: ['SA', 'Admin', 'Manager'],
    },
    {
        key: 'website',
        moduleId: 'website',
        label: 'Tổng quan Website',
        href: '/admin/website',
        icon: 'language',
        roles: ['SA', 'Admin'],
    },
    {
        key: 'website-branches',
        moduleId: 'website',
        label: 'Chi nhánh Website',
        href: '/admin/website/branches',
        icon: 'add_location_alt',
        roles: ['SA', 'Admin'],
    },
    {
        key: 'website-programs',
        moduleId: 'website',
        label: 'Chương trình Website',
        href: '/admin/website/programs',
        icon: 'fitness_center',
        roles: ['SA', 'Admin'],
    },
    {
        key: 'website-posts',
        moduleId: 'website',
        label: 'Bài viết Website',
        href: '/admin/website/posts',
        icon: 'article',
        roles: ['SA', 'Admin'],
    },
    {
        key: 'website-settings',
        moduleId: 'website',
        label: 'Cài đặt Website',
        href: '/admin/website/settings',
        icon: 'tune',
        roles: ['SA', 'Admin'],
    },
];

function hasMenuPermission(user, item) {
    if (!user?.role) return false;
    if (user.role === 'SA') return true;

    const checks = [];
    if (item.permission) checks.push(item.permission);
    if (item.permissions) checks.push(...item.permissions);

    if (checks.length > 0) {
        const viaPermission = checks.some((perm) =>
            permissionService.userHasPermissionSync(user, perm.resource, perm.action)
        );
        if (viaPermission) return true;
    } else if (MENU_KEY_PERMISSIONS[item.key]) {
        const perm = MENU_KEY_PERMISSIONS[item.key];
        if (permissionService.userHasPermissionSync(user, perm.resource, perm.action)) {
            return true;
        }
    }

    return item.roles.includes(user.role);
}

/**
 * @param {object|string} userOrRole - session user or role string (legacy)
 */
function getAllowedMenuItems(userOrRole) {
    const user = typeof userOrRole === 'string' ? { role: userOrRole } : userOrRole;
    if (!user?.role) return [];
    if (user.role === 'SA') return MENU_ITEMS;

    return MENU_ITEMS.filter((item) => hasMenuPermission(user, item));
}

/**
 * Menu items grouped by moduleId (for future collapsible sidebar).
 * @param {object|string} userOrRole
 */
function getAllowedMenuGroups(userOrRole) {
    const items = getAllowedMenuItems(userOrRole);
    const groups = [];
    let current = null;

    for (const item of items) {
        const moduleId = item.moduleId || 'dashboard';
        if (!current || current.moduleId !== moduleId) {
            const meta = MODULE_META[moduleId] || { icon: 'folder', collapsible: true };
            current = {
                moduleId,
                label: MODULE_LABELS[moduleId] || null,
                moduleIcon: meta.icon,
                collapsible: meta.collapsible,
                items: [],
            };
            groups.push(current);
        }
        current.items.push(item);
    }

    return groups;
}

/**
 * Serialize groups for sidebar Alpine component (keys safe for JSON).
 */
function getSidebarNavPayload(userOrRole, activePage = '') {
    const groups = getAllowedMenuGroups(userOrRole).map((g) => ({
        moduleId: g.moduleId,
        label: g.label,
        moduleIcon: g.moduleIcon,
        collapsible: g.collapsible,
        items: g.items.map((i) => ({
            key: i.key,
            label: i.label,
            href: i.href,
            icon: i.icon,
        })),
    }));

    return { groups, activePage: activePage || '' };
}

function getAllowedPageKeys(userOrRole) {
    return new Set(getAllowedMenuItems(userOrRole).map((item) => item.key));
}

module.exports = {
    MENU_ITEMS,
    MODULE_LABELS,
    MODULE_META,
    STORAGE_KEY_MODULES,
    getAllowedMenuItems,
    getAllowedMenuGroups,
    getSidebarNavPayload,
    getAllowedPageKeys,
    hasMenuPermission,
};
