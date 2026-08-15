const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('payroll', 'view'), payrollController.getPayrollSummary);
router.get('/summary', checkPermission('payroll', 'view'), payrollController.getPayrollSummary);

router.get('/export-csv', checkPermission('payroll', 'view'), payrollController.exportPayrollCSV);
router.get('/export-xlsx', checkPermission('payroll', 'view'), payrollController.exportPayrollXLSX);
router.post('/approve', checkPermission('payroll', 'manage'), payrollController.finalizePayroll);
router.post('/auto-suggest', checkPermission('payroll', 'manage'), payrollController.autoSuggestPayroll);
router.post('/mark-paid/:id', checkPermission('payroll', 'manage'), payrollController.markAsPaid);

module.exports = router;

