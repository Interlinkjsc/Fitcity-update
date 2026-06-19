const MealPlan = require('../models/mealPlanModel.js');
const Contract = require('../../contracts/models/contractModel.js');

exports.getMyClientsMealPlans = async (req, res, next) => {
    try {
        const filter = {};
        if (req.session.user.role === 'PT') {
            filter.pt = req.session.user.id;
        }

        const mealPlans = await MealPlan.find(filter)
            .populate('client', 'name email avatar')
            .populate('contract', 'contractStatus')
            .sort({ createdAt: -1 });

        res.render('pt/meal-plans/list', { 
            mealPlans,
            activePage: 'meal-plans' 
        });
    } catch (err) {
        next(err);
    }
};

exports.getCreateForm = async (req, res, next) => {
    try {
        const contracts = await Contract.find({
            pt: req.session.user.id,
            $or: [
                { contractStatus: 'Active' },
                { contractStatus: 'Draft', paymentStatus: 'Deposit' }
            ]
        }).populate('client');

        res.render('pt/meal-plans/form', { 
            contracts,
            activePage: 'meal-plans'
        });
    } catch (err) {
        next(err);
    }
};

exports.saveMealPlan = async (req, res, next) => {
    try {
        const { contractId, goal, calories, protein, carbs, fat, mealsJson } = req.body;
        
        const contract = await Contract.findById(contractId);
        if (!contract) return next(new Error('Contract not found'));

        const { parseMealFoodsText } = require('../../../utils/mealNutritionHelper');
        const parsedRaw = JSON.parse(mealsJson || '[]');
        const parsedMeals = parsedRaw.map((m) => {
            const notes = m.notes || '';
            const colonIdx = notes.indexOf(':');
            const mealLabel = colonIdx > -1 ? notes.slice(0, colonIdx).trim() : notes.trim();
            const foodsText = colonIdx > -1 ? notes.slice(colonIdx + 1).trim() : '';
            const foodItems =
                Array.isArray(m.foodItems) && m.foodItems.length
                    ? m.foodItems
                    : parseMealFoodsText(foodsText);
            return {
                time: m.time,
                notes: mealLabel || m.time,
                foodItems
            };
        });

        const planStart = contract.startDate ? new Date(contract.startDate) : new Date();
        const planEnd = contract.currentEndDate || contract.endDate
            ? new Date(contract.currentEndDate || contract.endDate)
            : new Date(planStart.getTime() + 30 * 24 * 60 * 60 * 1000);

        await MealPlan.updateMany({ client: contract.client, active: true }, { active: false });

        await MealPlan.create({
            client: contract.client,
            pt: req.session.user.id,
            contract: contractId,
            startDate: planStart,
            endDate: planEnd,
            goal,
            dailyCalories: Number(calories),
            macros: { protein, carbs, fat },
            meals: parsedMeals,
            status: 'pending_admin',
            active: false
        });

        const User = require('../../users/models/userModel');
        const notificationService = require('../../platform/services/notificationService');
        const admins = await User.find({ role: { $in: ['Admin', 'Manager'] } }).select('_id').lean();
        for (const admin of admins) {
            await notificationService.pushNotification(
                admin._id,
                'Kế hoạch dinh dưỡng mới chờ duyệt',
                `PT ${req.session.user.name} vừa tạo kế hoạch dinh dưỡng cho khách hàng. Vui lòng xem xét.`,
                'Warning', '/admin/meal-plans/pending', req.session.user.id
            );
        }

        req.flash('success_msg', 'Đã gửi kế hoạch dinh dưỡng, đang chờ Admin phê duyệt.');
        res.redirect('/pt/meal-plans');
    } catch (err) {
        next(err);
    }
};

exports.getDetail = async (req, res, next) => {
    try {
        const mealPlan = await MealPlan.findById(req.params.id)
            .populate('client', 'name email avatar')
            .populate('pt', 'name avatar')
            .populate('contract', 'contractCode contractStatus');
        if (!mealPlan) {
            req.flash('error_msg', 'Không tìm thấy thực đơn.');
            return res.redirect('/pt/meal-plans');
        }
        if (req.session.user.role === 'PT' && mealPlan.pt._id.toString() !== req.session.user.id) {
            req.flash('error_msg', 'Bạn không có quyền xem thực đơn này.');
            return res.redirect('/pt/meal-plans');
        }
        const { computeMealNutrition } = require('../../../utils/mealNutritionHelper');
        const mealNutritionByMeal = computeMealNutrition(mealPlan);
        res.render('pt/meal-plans/detail', {
            mealPlan,
            mealNutritionByMeal,
            activePage: 'meal-plans'
        });
    } catch (err) {
        next(err);
    }
};

