const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const paymentController = require('../controllers/paymentController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

// Xem danh sách hợp đồng
router.get('/list', checkPermission('contract', 'view'), contractController.getContractList);

// Chi tiết Hợp Đồng (Bao gồm check sở hữu chi nhánh bên trong checkPermission)
router.get('/detail/:id', checkPermission('contract', 'view'), contractController.getDetail);

// Tạo mới Hợp đồng (Sales, PT có quyền tạo)
router.get('/create', checkPermission('contract', 'create'), contractController.getCreateForm);
router.post('/store', checkPermission('contract', 'create'), contractController.storeContract);

// Form Sửa & Cập nhật (Chỉ Admin, SA hoặc Accountant quản lý chứng từ)
router.get('/edit/:id', checkPermission('contract', 'manage'), contractController.getEditForm);
router.post('/update/:id', checkPermission('contract', 'manage'), contractController.updateContract);

// Xóa (Chỉ SA và Admin)
router.post('/delete/:id', checkPermission('contract', 'delete'), contractController.deleteContract);

// Xuất PDF & Preview
router.get('/download/:id', checkPermission('contract', 'view'), contractController.downloadContract);
router.get('/:id/preview/contract', checkPermission('contract', 'view'), paymentController.previewContract);

// Bảo lưu và Kích hoạt lại (Cần quyền Manage)
router.post('/pause/:id', checkPermission('contract', 'manage'), contractController.pauseContract);
router.post('/unpause/:id', checkPermission('contract', 'manage'), contractController.unpauseContract);

// Quản lý Yêu cầu Bảo lưu
router.get('/requests', checkPermission('contract', 'manage'), contractController.getPauseRequests);
router.post('/requests/approve/:id', checkPermission('contract', 'manage'), contractController.approvePauseRequest);
router.post('/requests/reject/:id', checkPermission('contract', 'manage'), contractController.rejectPauseRequest);

// Đổi PT trong HĐ
router.post('/:id/change-pt', checkPermission('contract', 'manage'), contractController.changePt);

// ========== PAYMENT & PREVIEW ==========
router.post('/:id/payments/store', checkPermission('contract', 'manage'), paymentController.storePayment);
router.get('/:id/preview/receipt/:transactionId', checkPermission('contract', 'view'), paymentController.previewReceipt);

module.exports = router;

