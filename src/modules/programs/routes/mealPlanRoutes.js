const express = require('express');
const router = express.Router();
const mealPlanController = require('../controllers/mealPlanController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('meal_plan', 'view'), mealPlanController.getMyClientsMealPlans);
router.get('/create', checkPermission('meal_plan', 'create'), mealPlanController.getCreateForm);
router.post('/store', checkPermission('meal_plan', 'create'), mealPlanController.saveMealPlan);

router.get('/:id', checkPermission('meal_plan', 'view'), mealPlanController.getDetail);

module.exports = router;

