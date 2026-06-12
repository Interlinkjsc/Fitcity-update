const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/list', checkPermission('branch_dashboard', 'view'), branchController.getBranchList);

router.get('/create', checkPermission('user_management', 'manage'), branchController.getCreateForm);
router.post('/store', checkPermission('user_management', 'manage'), branchController.storeBranch);

router.get('/detail/:id', checkPermission('branch_dashboard', 'view', true), branchController.getDetail);

router.get('/edit/:id', checkPermission('user_management', 'manage'), branchController.getEditForm);
router.post('/update/:id', checkPermission('user_management', 'manage'), branchController.updateBranch);

router.post('/delete/:id', checkPermission('user_management', 'delete'), branchController.deleteBranch);

module.exports = router;

