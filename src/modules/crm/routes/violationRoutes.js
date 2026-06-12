const express = require('express');
const router = express.Router();
const violationController = require('../controllers/violationController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('violations', 'view'), violationController.getViolations);
router.get('/create', checkPermission('violations', 'manage'), violationController.getCreateViolation);
router.post('/store', checkPermission('violations', 'manage'), violationController.createViolation);
router.get('/edit/:id', checkPermission('violations', 'manage'), violationController.getEditViolation);
router.post('/update/:id', checkPermission('violations', 'manage'), violationController.updateViolation);
router.post('/delete/:id', checkPermission('violations', 'manage'), violationController.deleteViolation);

module.exports = router;
