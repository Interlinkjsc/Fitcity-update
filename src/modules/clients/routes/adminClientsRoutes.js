const express = require('express');
const router = express.Router();
const clientManagementController = require('../controllers/clientManagementController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/list', checkPermission('client_management', 'view'), clientManagementController.getClientList);
router.get('/create', checkPermission('client_management', 'create'), clientManagementController.getCreateForm);
router.post('/store', checkPermission('client_management', 'create'), clientManagementController.storeClient);
router.get('/edit/:id', checkPermission('client_management', 'update'), clientManagementController.getEditForm);
router.post('/update/:id', checkPermission('client_management', 'update'), clientManagementController.updateClient);
router.post('/delete/:id', checkPermission('client_management', 'delete'), clientManagementController.deleteClient);
router.get('/detail/:id', checkPermission('client_management', 'view'), clientManagementController.getDetail);
// Bug 23/7 A16: xuất / nhập danh sách khách hàng (Excel/CSV)
router.get('/export', checkPermission('client_management', 'view'), clientManagementController.exportClients);
const { clientImportUploadMiddleware } = require('../../../middlewares/clientImportUploadMiddleware');
router.post('/import', checkPermission('client_management', 'create'), clientImportUploadMiddleware, clientManagementController.importClients);

module.exports = router;

