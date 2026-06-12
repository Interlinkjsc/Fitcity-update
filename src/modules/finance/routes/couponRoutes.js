const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { protect, checkPermission } = require('../../../middlewares/authMiddleware');

router.use(protect);

router.get('/', checkPermission('coupons', 'view'), couponController.getCouponList);
router.get('/create', checkPermission('coupons', 'manage'), couponController.getCreateForm);
router.post('/store', checkPermission('coupons', 'manage'), couponController.storeCoupon);
router.post('/assign-reward', checkPermission('coupons', 'manage'), couponController.assignReward);
router.get('/detail/:id', checkPermission('coupons', 'view'), couponController.getDetail);
router.get('/edit/:id', checkPermission('coupons', 'manage'), couponController.getEditForm);
router.post('/update/:id', checkPermission('coupons', 'manage'), couponController.updateCoupon);
router.patch('/:id', checkPermission('coupons', 'manage'), couponController.updateCoupon);
router.post('/delete/:id', checkPermission('coupons', 'delete'), couponController.deleteCoupon);

module.exports = router;
