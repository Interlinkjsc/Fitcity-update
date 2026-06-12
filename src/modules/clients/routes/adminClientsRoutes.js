const express = require('express');
const router = express.Router();
const clientManagementController = require('../controllers/clientManagementController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/list', checkPermission('staff_management', 'view'), clientManagementController.getClientList);
router.get('/create', checkPermission('staff_management', 'create'), clientManagementController.getCreateForm);
router.post('/store', checkPermission('staff_management', 'create'), clientManagementController.storeClient);
router.get('/edit/:id', checkPermission('staff_management', 'update'), clientManagementController.getEditForm);
router.post('/update/:id', checkPermission('staff_management', 'update'), clientManagementController.updateClient);
router.post('/delete/:id', checkPermission('staff_management', 'delete'), clientManagementController.deleteClient);
router.get('/detail/:id', checkPermission('staff_management', 'view'), clientManagementController.getDetail);

module.exports = router;

