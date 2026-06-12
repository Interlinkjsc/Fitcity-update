const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpiController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('kpi', 'view'), kpiController.getKPIList);
router.post('/save', checkPermission('kpi', 'manage'), kpiController.saveKPI);

module.exports = router;
