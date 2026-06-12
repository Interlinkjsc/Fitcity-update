const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('checklist', 'view'), checklistController.getList);
router.get('/create', checkPermission('checklist', 'manage'), checklistController.getCreateForm);
router.post('/store', checkPermission('checklist', 'manage'), checklistController.store);
router.get('/edit/:id', checkPermission('checklist', 'manage'), checklistController.getEditForm);
router.post('/update/:id', checkPermission('checklist', 'manage'), checklistController.update);
router.post('/delete/:id', checkPermission('checklist', 'manage'), checklistController.delete);

module.exports = router;
