const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

// Public routes
router.get('/', leadController.getLandingPage);
router.get('/landing-old', leadController.getLandingPageOld);
// Blog/contact công khai giờ nằm trên web đen (fitcity-web) — redirect giữ SEO cũ
router.get('/contact', (req, res) => res.redirect((process.env.WEBSITE_URL || 'https://fitcity.fit') + '/dang-ky'));
router.get('/blog', (req, res) => res.redirect((process.env.WEBSITE_URL || 'https://fitcity.fit') + '/blog'));
router.get('/blog/:slug', (req, res) => res.redirect((process.env.WEBSITE_URL || 'https://fitcity.fit') + '/blog/' + encodeURIComponent(req.params.slug)));
router.post('/register-lead', leadController.registerLead);
// Alias tương thích: web/env cũ trỏ /api/crm/register-lead → tránh 404 form học thử
router.post('/api/crm/register-lead', leadController.registerLead);

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
router.post('/admin/leads/detail/:id/branch', protect, checkPermission('leads', 'view'), leadController.updateLeadBranch);
router.post(
    '/admin/leads/detail/:id/convert',
    protect,
    checkPermission('leads', 'manage'),
    leadController.convertLeadToClient
);

module.exports = router;
