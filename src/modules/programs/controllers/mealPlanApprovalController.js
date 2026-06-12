const MealPlan = require('../models/mealPlanModel');
const notificationService = require('../../platform/services/notificationService');

// GET /admin/meal-plans/pending
exports.getPendingList = async (req, res, next) => {
  try {
    const mealPlans = await MealPlan.find({ status: 'pending_admin' })
      .populate('client', 'name email avatar')
      .populate('pt', 'name avatar')
      .populate('contract', 'contractCode')
      .sort({ createdAt: -1 }).lean();
    res.render('admin/meal-plans/pending-list', { mealPlans, activePage: 'meal-plan-approval' });
  } catch (err) { next(err); }
};

// GET /admin/meal-plans/pending/:id  (xem detail trước khi duyệt)
exports.getPendingDetail = async (req, res, next) => {
  try {
    const mealPlan = await MealPlan.findById(req.params.id)
      .populate('client', 'name email avatar')
      .populate('pt', 'name avatar')
      .populate('contract', 'contractCode packageSnapshot');
    if (!mealPlan) { req.flash('error_msg', 'Không tìm thấy kế hoạch dinh dưỡng.'); return res.redirect('/admin/meal-plans/pending'); }
    const { computeMealNutrition } = require('../../../utils/mealNutritionHelper');
    const mealNutritionByMeal = computeMealNutrition(mealPlan);
    res.render('admin/meal-plans/pending-detail', { mealPlan, mealNutritionByMeal, activePage: 'meal-plan-approval' });
  } catch (err) { next(err); }
};

// POST /admin/meal-plans/:id/approve
exports.approve = async (req, res, next) => {
  try {
    const mealPlan = await MealPlan.findById(req.params.id);
    if (!mealPlan || mealPlan.status !== 'pending_admin') { req.flash('error_msg', 'Không thể duyệt kế hoạch này.'); return res.redirect('/admin/meal-plans/pending'); }
    mealPlan.status = 'approved';
    mealPlan.active = true;
    await mealPlan.save();
    await notificationService.pushNotification(mealPlan.client, 'Kế hoạch dinh dưỡng đã được duyệt', 'Kế hoạch dinh dưỡng của bạn đã được Admin phê duyệt. Hãy xem ngay!', 'Success', '/client/nutrition', req.session.user.id);
    await notificationService.pushNotification(mealPlan.pt, 'Kế hoạch dinh dưỡng đã được duyệt', 'Admin đã phê duyệt kế hoạch dinh dưỡng bạn tạo.', 'Success', '/pt/meal-plans', req.session.user.id);
    req.flash('success_msg', 'Đã phê duyệt kế hoạch dinh dưỡng.');
    res.redirect('/admin/meal-plans/pending');
  } catch (err) { next(err); }
};

// POST /admin/meal-plans/:id/reject
exports.reject = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const mealPlan = await MealPlan.findById(req.params.id);
    if (!mealPlan || mealPlan.status !== 'pending_admin') { req.flash('error_msg', 'Không thể từ chối kế hoạch này.'); return res.redirect('/admin/meal-plans/pending'); }
    mealPlan.status = 'rejected';
    mealPlan.active = false;
    mealPlan.rejectionReason = reason || '';
    await mealPlan.save();
    await notificationService.pushNotification(mealPlan.client, 'Kế hoạch dinh dưỡng bị từ chối', `Kế hoạch dinh dưỡng của bạn chưa được duyệt. Lý do: ${reason || 'Không có'}`, 'Error', '/client/nutrition', req.session.user.id);
    await notificationService.pushNotification(mealPlan.pt, 'Kế hoạch dinh dưỡng bị từ chối', `Admin từ chối kế hoạch bạn tạo. Lý do: ${reason || 'Không có'}`, 'Error', '/pt/meal-plans', req.session.user.id);
    req.flash('success_msg', 'Đã từ chối kế hoạch dinh dưỡng.');
    res.redirect('/admin/meal-plans/pending');
  } catch (err) { next(err); }
};
