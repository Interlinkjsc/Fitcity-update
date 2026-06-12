const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

// Public routes
router.get('/', leadController.getLandingPage);
router.get('/contact', leadController.getContactPage);
router.get('/blog', leadController.getBlogList);
router.get('/blog/:slug', leadController.getBlogPost);
router.post('/register-lead', leadController.registerLead);

// Admin-only routes (for Leads management)
router.get('/admin/leads', protect, checkPermission('leads', 'view'), leadController.getAllLeads);
router.get('/admin/leads/export', protect, checkPermission('leads', 'view'), leadController.exportLeadsExcel);
router.get('/admin/leads/detail/:id', protect, checkPermission('leads', 'view'), leadController.getDetail);
router.post(
    '/admin/leads/detail/:id/status',
    protect,
    checkPermission('leads', 'manage'),
    leadController.updateLeadStatus
);
router.post(
    '/admin/leads/detail/:id/convert',
    protect,
    checkPermission('leads', 'manage'),
    leadController.convertLeadToClient
);

module.exports = router;
