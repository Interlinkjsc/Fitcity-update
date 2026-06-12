const express = require('express');
const router = express.Router();
const metricController = require('../controllers/metricController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.get('/pt/metrics', protect, checkPermission('pt_session', 'view'), metricController.getMyClientsForMetrics);
router.get('/pt/metrics/add/:clientId', protect, checkPermission('pt_session', 'update'), metricController.getAddMetricForm);
router.get('/pt/metrics/history/:clientId', protect, checkPermission('pt_session', 'view'), metricController.getMetricHistory);
router.post('/pt/metrics/add/:clientId', protect, checkPermission('pt_session', 'update'), metricController.saveBodyMetric);

router.get('/client/progress', protect, checkPermission('meal_plan', 'view'), metricController.getMyProgress);

module.exports = router;

