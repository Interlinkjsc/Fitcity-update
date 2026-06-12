const express = require('express');
const router = express.Router();
const jobDescriptionController = require('../controllers/jobDescriptionController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/api/by-role', checkPermission('job_description', 'view'), jobDescriptionController.getByRoleApi);
router.get('/', checkPermission('job_description', 'view'), jobDescriptionController.getList);
router.get('/create', checkPermission('job_description', 'manage'), jobDescriptionController.getCreateForm);
router.post('/store', checkPermission('job_description', 'manage'), jobDescriptionController.store);
router.get('/edit/:id', checkPermission('job_description', 'manage'), jobDescriptionController.getEditForm);
router.post('/update/:id', checkPermission('job_description', 'manage'), jobDescriptionController.update);
router.post('/delete/:id', checkPermission('job_description', 'manage'), jobDescriptionController.delete);

module.exports = router;
