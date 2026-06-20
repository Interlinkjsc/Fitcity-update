const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/websiteController');
const { protect, restrictTo } = require('../../../middlewares/authMiddleware');

router.use(protect, restrictTo('SA', 'Admin'));

router.get('/', ctrl.getDashboard);

// Branches
router.get('/branches', ctrl.getBranches);
router.get('/branches/create', ctrl.createBranch);
router.post('/branches/store', ctrl.storeBranch);
router.get('/branches/edit/:id', ctrl.editBranch);
router.post('/branches/update/:id', ctrl.updateBranch);
router.post('/branches/delete/:id', ctrl.deleteBranch);

// Programs
router.get('/programs', ctrl.getPrograms);
router.get('/programs/create', ctrl.createProgram);
router.post('/programs/store', ctrl.storeProgram);
router.get('/programs/edit/:id', ctrl.editProgram);
router.post('/programs/update/:id', ctrl.updateProgram);
router.post('/programs/delete/:id', ctrl.deleteProgram);

// Posts
router.get('/posts', ctrl.getPosts);
router.get('/posts/create', ctrl.createPost);
router.post('/posts/store', ctrl.storePost);
router.get('/posts/edit/:id', ctrl.editPost);
router.post('/posts/update/:id', ctrl.updatePost);
router.post('/posts/delete/:id', ctrl.deletePost);

// Settings
router.get('/settings', ctrl.getSettings);
router.post('/settings/save', ctrl.updateSettings);

module.exports = router;
