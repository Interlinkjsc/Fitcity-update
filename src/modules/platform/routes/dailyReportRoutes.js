const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');
const { protect, checkPermission, restrictTo } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('daily_report', 'view'), dailyReportController.getAdminList);
router.get('/detail/:id', checkPermission('daily_report', 'view'), dailyReportController.getDetail);
router.get(
    '/submit',
    checkPermission('daily_report', 'submit'),
    restrictTo('PT', 'Sales', 'Manager', 'Marketing', 'Accountant', 'Admin', 'CEO'),
    dailyReportController.getSubmitPage
);
router.post(
    '/submit',
    checkPermission('daily_report', 'submit'),
    restrictTo('PT', 'Sales', 'Manager', 'Marketing', 'Accountant', 'Admin', 'CEO'),
    dailyReportController.submit
);
router.post('/approve/:id', checkPermission('daily_report', 'manage'), dailyReportController.approve);
router.post('/reject/:id', checkPermission('daily_report', 'manage'), dailyReportController.reject);

module.exports = router;
