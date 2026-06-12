const express = require('express');
const router = express.Router();
const adminSlotController = require('../controllers/adminSlotController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('slots', 'view'), adminSlotController.showCalendar);
router.get('/calendar', checkPermission('slots', 'view'), adminSlotController.showCalendar);
router.get('/requests', checkPermission('slots', 'view'), adminSlotController.listRequests);

module.exports = router;
