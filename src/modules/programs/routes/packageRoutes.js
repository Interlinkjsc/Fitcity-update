const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/list', checkPermission('packages', 'view'), packageController.getPackageList);
router.get('/detail/:id', checkPermission('packages', 'view'), packageController.getDetail);
router.get('/create', checkPermission('packages', 'manage'), packageController.getCreateForm);
router.post('/store', checkPermission('packages', 'manage'), packageController.storePackage);
router.get('/edit/:id', checkPermission('packages', 'manage'), packageController.getEditForm);
router.post('/update/:id', checkPermission('packages', 'manage'), packageController.updatePackage);
router.post('/delete/:id', checkPermission('packages', 'manage'), packageController.deletePackage);

module.exports = router;
