const express = require('express');
const router = express.Router();
const adminSlotController = require('../controllers/adminSlotController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('slots', 'view'), adminSlotController.showCalendar);
router.get('/calendar', checkPermission('slots', 'view'), adminSlotController.showCalendar);
router.get('/requests', checkPermission('slots', 'view'), adminSlotController.listRequests);
router.post('/requests/:id/approve', checkPermission('slots', 'manage'), adminSlotController.approveRequest);
router.post('/requests/:id/reject', checkPermission('slots', 'manage'), adminSlotController.rejectRequest);

module.exports = router;
