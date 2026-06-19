const MealLog = require('../models/mealLogModel');
const MealPlan = require('../models/mealPlanModel');
const User = require('../../users/models/userModel');
const Contract = require('../../contracts/models/contractModel');

// GET /pt/clients/:clientId/meal-logs
exports.getPtClientMealLogs = async (req, res, next) => {
  try {
    const ptId = req.session.user.id;
    const { clientId } = req.params;
    // Verify PT owns this client
    const contract = await Contract.findOne({ pt: ptId, client: clientId, $or: [{ contractStatus: 'Active' }, { contractStatus: 'Draft', paymentStatus: 'Deposit' }] })
      .populate('client', 'name avatar').lean();
    if (!contract) { req.flash('error_msg', 'Bạn không có quyền xem khách hàng này.'); return res.redirect('/pt/clients'); }
    const days = parseInt(req.query.days) || 14;
    const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0, 0, 0, 0);
    const logs = await MealLog.find({ client: clientId, logDate: { $gte: from } }).sort({ logDate: -1, mealType: 1 }).lean();
    const activeMealPlan = await MealPlan.findOne({ client: clientId, status: 'approved', active: true }).lean();
    res.render('pt/meal-log-monitor', { client: contract.client, logs, activeMealPlan, days, activePage: 'meal-plans' });
  } catch (err) { next(err); }
};
