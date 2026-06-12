const express = require('express');
const router = express.Router();
const contentLibraryController = require('../controllers/contentLibraryController');
const { contentUploadMiddleware } = require('../../../middlewares/contentUploadMiddleware');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('content_library', 'view'), contentLibraryController.getList);
router.post(
    '/store',
    checkPermission('content_library', 'manage'),
    contentUploadMiddleware,
    contentLibraryController.store
);
router.post('/delete/:id', checkPermission('content_library', 'manage'), contentLibraryController.delete);

module.exports = router;
