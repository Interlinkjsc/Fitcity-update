const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { expenseUploadMiddleware } = require('../../../middlewares/expenseUploadMiddleware');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('expenses', 'view'), expenseController.getAllExpenses);
router.get('/export', checkPermission('expenses', 'view'), expenseController.exportExpensesExcel);
router.post(
    '/store',
    checkPermission('expenses', 'manage'),
    expenseUploadMiddleware,
    expenseController.saveExpense
);
router.get('/detail/:id', checkPermission('expenses', 'view'), expenseController.getDetail);
router.post('/delete/:id', checkPermission('expenses', 'delete'), expenseController.deleteExpense);

module.exports = router;
