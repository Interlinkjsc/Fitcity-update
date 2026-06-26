const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sessionApprovalController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);
router.get('/pending', checkPermission('session_approval', 'view'), ctrl.getPendingList);
router.get('/pt-feedback', checkPermission('session_approval', 'view'), ctrl.getPtFeedbackList);
router.post('/:id/approve', checkPermission('session_approval', 'manage'), ctrl.approveSession);
router.post('/:id/reject', checkPermission('session_approval', 'manage'), ctrl.rejectSession);
router.post('/:id/edit-approve', checkPermission('session_approval', 'manage'), ctrl.editAndApprove);

module.exports = router;
