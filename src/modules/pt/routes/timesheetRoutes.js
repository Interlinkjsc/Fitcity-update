const express = require('express');
const router = express.Router();
const timesheetController = require('../controllers/timesheetController');
const { protect, checkPermission, restrictTo } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('timesheet', 'view'), timesheetController.getAdminList);
router.post('/approve/:id', checkPermission('timesheet', 'manage'), timesheetController.approve);
router.post('/reject/:id', checkPermission('timesheet', 'manage'), timesheetController.reject);

module.exports = router;
