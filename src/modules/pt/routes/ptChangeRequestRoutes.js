const express = require('express');
const router = express.Router();
const ptChangeRequestController = require('../controllers/ptChangeRequestController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('pt_change', 'view'), ptChangeRequestController.getPTChangeRequests);
router.post('/:id/update', checkPermission('pt_change', 'manage'), ptChangeRequestController.updatePTChangeRequest);

module.exports = router;
