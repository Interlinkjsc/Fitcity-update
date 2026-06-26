const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/webSettingController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);
router.get('/', checkPermission('cms', 'view'), ctrl.getAdminSettingsPage);
router.post('/', checkPermission('cms', 'view'), ctrl.updateAdminSettings);

module.exports = router;
