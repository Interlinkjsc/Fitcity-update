const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/webSettingController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');
const { slotImageUploadMiddleware } = require('../../../middlewares/slotImageUploadMiddleware');

router.use(protect);
router.get('/', checkPermission('cms', 'view'), ctrl.getAdminSettingsPage);
router.post('/', checkPermission('cms', 'view'), ctrl.updateAdminSettings);
// Ảnh website theo vị trí (slot) — upload/gỡ, hiển thị ngay không cần rebuild
router.post('/slot-images', checkPermission('cms', 'view'), slotImageUploadMiddleware, ctrl.uploadSlotImage);
router.post('/slot-images/delete', checkPermission('cms', 'view'), ctrl.deleteSlotImage);

module.exports = router;
