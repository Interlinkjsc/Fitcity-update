const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('system_settings', 'view'), settingsController.getSettingsPage);
router.post('/', checkPermission('system_settings', 'update'), settingsController.updateSettings);

module.exports = router;
