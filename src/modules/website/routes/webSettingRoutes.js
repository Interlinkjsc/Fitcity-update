const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/webSettingController');
const { protect, checkPermission, restrictTo } = require('../../../middlewares/authMiddleware');
const { slotImageUploadMiddleware } = require('../../../middlewares/slotImageUploadMiddleware');

// CMS website: CHỈ tài khoản admin (SA/Admin) — yêu cầu 2/7/2026
router.use(protect, restrictTo('SA', 'Admin'));
router.get('/', checkPermission('cms', 'view'), ctrl.getAdminSettingsPage);
router.post('/', checkPermission('cms', 'view'), ctrl.updateAdminSettings);
// Ảnh website theo vị trí (slot) — upload/gỡ, hiển thị ngay không cần rebuild
router.post('/slot-images', checkPermission('cms', 'view'), slotImageUploadMiddleware, ctrl.uploadSlotImage);
router.post('/slot-images/delete', checkPermission('cms', 'view'), ctrl.deleteSlotImage);
// Zalo ZNS: admin dán token / app creds + test kết nối
router.post('/zalo', checkPermission('cms', 'view'), ctrl.updateZaloSettings);
router.post('/zalo/test', checkPermission('cms', 'view'), ctrl.testZaloConnection);
router.get('/zalo/connect', checkPermission('cms', 'view'), ctrl.zaloConnect);
router.get('/zalo/callback', ctrl.zaloCallback);

module.exports = router;
