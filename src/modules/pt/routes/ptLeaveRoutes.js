const express = require('express');
const router = express.Router();
const ptLeaveController = require('../controllers/ptLeaveController');
const { protect, checkPermission, restrictTo } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('pt_leave', 'view'), ptLeaveController.getAdminList);
router.post('/approve/:id', checkPermission('pt_leave', 'manage'), ptLeaveController.approve);
router.post('/reject/:id', checkPermission('pt_leave', 'manage'), ptLeaveController.reject);

module.exports = router;
