const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('rewards', 'view'), rewardController.getRewardList);
router.get('/create', checkPermission('rewards', 'manage'), rewardController.getCreateForm);
router.post('/store', checkPermission('rewards', 'manage'), rewardController.storeReward);
router.get('/detail/:id', checkPermission('rewards', 'view'), rewardController.getDetail);
router.post('/delete/:id', checkPermission('rewards', 'delete'), rewardController.deleteReward);

module.exports = router;
