/**
 * Đăng ký router theo thứ tự — một nơi để thêm/bớt mount khi tạo feature mới.
 * Thứ tự giữ nguyên như cấu hình Express trước đây (route '/' có thể shadow nếu đổi thứ tự).
 */
function mountFeatureRouters(app) {
    const { authRoutes } = require('../modules/auth/routes');
    const { userRoutes } = require('../modules/users/routes');
    const { clientRoutes, clientAdminRoutes } = require('../modules/clients/routes');
    const { contractRoutes } = require('../modules/contracts/routes');
    const { ptRoutes, slotRoutes, ptChangeRequestRoutes, timesheetRoutes, ptLeaveRoutes } =
        require('../modules/pt/routes');
    const { payrollRoutes, expenseRoutes, couponRoutes } = require('../modules/finance/routes');
    const { packageRoutes, mealPlanRoutes, rewardRoutes, metricRoutes, kpiRoutes, sessionApprovalRoutes, mealPlanApprovalRoutes } = require('../modules/programs/routes');
    const { leadRoutes, cmsRoutes, contentLibraryRoutes, branchRoutes, violationRoutes } =
        require('../modules/crm/routes');
    const { calendarRoutes } = require('../modules/api/routes');
    const rolePermissionRoutes = require('../modules/platform/routes/rolePermissionRoutes');
    const {
        checklistRoutes,
        settingsRoutes,
        jobDescriptionRoutes,
        dailyReportRoutes
    } = require('../modules/platform/routes');
    const workReportController = require('../modules/platform/controllers/workReportController');

    app.use('/auth', authRoutes);
    app.use('/admin/permissions', rolePermissionRoutes);
    app.use('/admin/checklists', checklistRoutes);
    app.use('/admin/settings', settingsRoutes);
    app.use('/admin/job-descriptions', jobDescriptionRoutes);
    app.use('/admin/daily-reports', dailyReportRoutes);
    app.use('/admin/packages', packageRoutes);
    app.use('/admin/branches', branchRoutes);
    app.use('/admin/users', userRoutes);
    app.use('/admin/clients', clientAdminRoutes);
    app.use('/admin/contracts', contractRoutes);
    app.use('/admin/payroll', payrollRoutes);
    app.use('/pt', ptRoutes);
    app.use('/client', clientRoutes);
    app.use('/', leadRoutes);
    app.use('/admin/cms', cmsRoutes);
    app.use('/admin/content-library', contentLibraryRoutes);
    app.use('/', metricRoutes);
    app.use('/admin/expenses', expenseRoutes);
    app.use('/pt/meal-plans', mealPlanRoutes);
    app.use('/admin/coupons', couponRoutes);
    app.use('/admin/kpi', kpiRoutes);
    app.use('/admin/slots', slotRoutes);
    app.use('/admin/rewards', rewardRoutes);
    app.use('/admin/violations', violationRoutes);
    app.use('/admin/pt-change-requests', ptChangeRequestRoutes);
    app.use('/admin/timesheets', timesheetRoutes);
    app.use('/admin/pt-leave-requests', ptLeaveRoutes);
    app.use('/admin/sessions', sessionApprovalRoutes);
    app.get('/admin/pt-feedback', require('../middlewares/authMiddleware').protect, require('../middlewares/authMiddleware').checkPermission('session_approval', 'view'), require('../modules/programs/controllers/sessionApprovalController').getPtFeedbackList);
    app.use('/admin/meal-plans', mealPlanApprovalRoutes);
    app.use('/api/calendar', calendarRoutes);

    // Public web APIs (no auth): settings / branches / programs / posts / slot-images
    const webSettingCtrl = require('../modules/website/controllers/webSettingController');
    app.get('/api/web/settings', webSettingCtrl.apiGetSettings);
    app.get('/api/web/slot-images', webSettingCtrl.apiGetSlotImages);
    const webApiRoutes = require('../modules/website/routes/webApiRoutes');
    app.use('/api/web', webApiRoutes);

    // Zalo OA callback CÔNG KHAI (mount TRƯỚC router admin để chủ OA bấm link từ điện thoại
    // của họ mà không cần đăng nhập ERP). Chỉ xử lý khi có ?code, phần còn lại vẫn qua router admin.
    app.get('/admin/website/settings/zalo/callback', webSettingCtrl.zaloPublicCallback);

    // Admin website CMS: settings (mount TRƯỚC /admin/website để không bị nuốt route)
    const webSettingRoutes = require('../modules/website/routes/webSettingRoutes');
    app.use('/admin/website/settings', webSettingRoutes);
    // Admin website CMS: chi nhánh / chương trình / bài viết
    const websiteRoutes = require('../modules/website/routes/websiteRoutes');
    app.use('/admin/website', websiteRoutes);
}

/**
 * Các route dashboard “page” (không phải mount router cả prefix).
 * @param {import('express').Application} app
 * @param {{ homeController: object, protect: import('express').RequestHandler, restrictTo: (...roles: string[]) => import('express').RequestHandler }} deps
 */
function mountDashboardRoutes(app, { homeController, protect, restrictTo }) {
    const workReportController = require('../modules/platform/controllers/workReportController');
    app.get('/admin', protect, restrictTo('Admin', 'Manager', 'SA', 'CEO', 'Accountant', 'Sales', 'Marketing'), homeController.getAdminDashboard);
    app.get('/admin/export-report', protect, restrictTo('Admin', 'SA', 'CEO'), homeController.exportReport);
    app.get(
        '/admin/export-work-report',
        protect,
        restrictTo('Admin', 'SA', 'CEO', 'Manager'),
        workReportController.exportWorkReport
    );
    app.get('/client', protect, restrictTo('Client'), homeController.getClientDashboard);
    app.get('/client/nutrition', protect, restrictTo('Client'), homeController.getClientNutrition);
    app.get('/pt', protect, restrictTo('PT'), homeController.getPtDashboard);
    app.get('/pt/dashboard', (req, res) => res.redirect('/pt'));
}

module.exports = {
    mountFeatureRouters,
    mountDashboardRoutes
};
