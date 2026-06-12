const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mealPlanApprovalController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);
router.get('/pending', checkPermission('meal_plan_approval', 'view'), ctrl.getPendingList);
router.get('/pending/:id', checkPermission('meal_plan_approval', 'view'), ctrl.getPendingDetail);
router.post('/:id/approve', checkPermission('meal_plan_approval', 'manage'), ctrl.approve);
router.post('/:id/reject', checkPermission('meal_plan_approval', 'manage'), ctrl.reject);

module.exports = router;
