const express = require('express');
const router = express.Router();
const rolePermissionController = require('../controllers/rolePermissionController');
const { protect, restrictTo } = require('../../../middlewares/authMiddleware');

router.use(protect);
router.use(restrictTo('SA'));

router.get('/', rolePermissionController.getPermissionManager);
router.get('/api/suggested', rolePermissionController.getSuggestedApi);
router.post('/save', rolePermissionController.saveRolePermissions);
router.post('/reset-suggested', rolePermissionController.resetToSuggested);

module.exports = router;
