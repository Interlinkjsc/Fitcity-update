const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('cms', 'view'), cmsController.getList);
router.get('/create', checkPermission('cms', 'manage'), cmsController.getCreateForm);
router.post('/store', checkPermission('cms', 'manage'), cmsController.store);
router.get('/edit/:id', checkPermission('cms', 'manage'), cmsController.getEditForm);
router.post('/update/:id', checkPermission('cms', 'manage'), cmsController.update);
router.post('/delete/:id', checkPermission('cms', 'manage'), cmsController.delete);

module.exports = router;
