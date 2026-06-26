const express = require('express');
const router = express.Router();
const ptController = require('../controllers/ptController');
const timesheetController = require('../controllers/timesheetController');
const dailyReportController = require('../../platform/controllers/dailyReportController');
const ptLeaveController = require('../controllers/ptLeaveController');
const workoutAssignmentController = require('../../programs/controllers/workoutAssignmentController');
const mealMonitorController = require('../../programs/controllers/mealPlanMonitorController');
const homeController = require('../../platform/controllers/homeController');
const { protect, checkPermission, restrictTo } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.post('/sessions/complete', checkPermission('pt_session', 'update'), (req, res) => {
    const { clientConfirmed } = req.body;
    if (!clientConfirmed) {
        return res.status(400).json({ status: 'fail', message: 'Cần xác nhận từ Client' });
    }
    res.json({ status: 'success' });
});

router.post('/sessions/check-out/:id', ptController.checkOutSession);
router.post('/sessions/:id/accept-cancel', restrictTo('PT'), ptController.acceptCancelRequest);
router.post('/sessions/:id/reject-cancel', restrictTo('PT'), ptController.rejectCancelRequest);

router.get('/contracts/create', checkPermission('contract', 'create'), require('../../contracts/controllers/contractController').getCreateForm);
router.post('/contracts/store', checkPermission('contract', 'create'), require('../../contracts/controllers/contractController').storeContract);

router.get('/clients', homeController.getPtClients);
router.get('/schedule', homeController.getPtSchedule);

router.get('/income', ptController.getIncome);

// BỎ CHẤM CÔNG PT — bug report 26/6
// router.get('/attendance', restrictTo('PT'), timesheetController.getPtAttendancePage);
// router.post('/attendance/check-in', restrictTo('PT'), timesheetController.ptCheckIn);
// router.post('/attendance/check-out', restrictTo('PT'), timesheetController.ptCheckOut);
router.get('/attendance', (req, res) => res.redirect('/pt'));

router.get('/daily-report', restrictTo('PT'), dailyReportController.getSubmitPage);
router.post('/daily-report', restrictTo('PT'), dailyReportController.submit);
router.get('/leave', restrictTo('PT'), ptLeaveController.getPtLeavePage);
router.post('/leave', restrictTo('PT'), ptLeaveController.submitLeave);

router.post('/sessions/scan-qr', ptController.scanQrToken);

router.post('/sessions/create-direct', restrictTo('PT'), ptController.createDirectSession);

router.get('/requests', ptController.getPendingRequests);

router.get('/meal-plan/:id/edit', ptController.getMealPlanEdit);
router.post('/meal-plan/:id/update', ptController.updateMealPlan);

router.get('/workout-assignments', checkPermission('meal_plan', 'view'), workoutAssignmentController.getAssignPage);
router.post('/workout-assignments', checkPermission('meal_plan', 'create'), workoutAssignmentController.storeAssignment);

router.get('/clients/:clientId/meal-logs', checkPermission('meal_plan', 'view'), mealMonitorController.getPtClientMealLogs);

module.exports = router;

