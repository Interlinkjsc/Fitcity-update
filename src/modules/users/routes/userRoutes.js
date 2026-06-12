const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

// User Management
router.use(protect);

// Danh sách Nhân viên
router.get('/list', checkPermission('staff_management', 'view'), userController.getUserList);

// Chi Tiết
router.get('/detail/:id', checkPermission('staff_management', 'view'), userController.getDetail);
router.post('/detail/:id/kpi-target', checkPermission('kpi', 'manage'), userController.saveEmployeeKPITarget);

router.get('/api/role-permissions', checkPermission('staff_management', 'view'), userController.getRolePermissionsApi);

// Form Tạo mới / Sửa
router.get('/create', checkPermission('staff_management', 'create'), userController.getCreateForm);
router.post('/store', checkPermission('staff_management', 'create'), userController.storeUser);
router.get('/edit/:id', checkPermission('staff_management', 'update'), userController.getEditForm);
router.post('/update/:id', checkPermission('staff_management', 'update'), userController.updateUser);

// Xóa (POST)
router.post('/delete/:id', checkPermission('staff_management', 'delete'), userController.deleteUser);

// Stub for Branch Dashboard test
router.get('/dashboard/branch/:branchId', checkPermission('branch_dashboard', 'view'), (req, res) => {
    res.json({ status: 'success' });
});

module.exports = router;
