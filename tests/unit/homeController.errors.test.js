const homeController = require('../../src/modules/platform/controllers/homeController.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');
const MealPlan = require('../../src/modules/programs/models/mealPlanModel.js');
const Expense = require('../../src/modules/finance/models/expenseModel.js');

describe('Home Controller Error Coverage', () => {
    let req, res, next;

    beforeEach(() => {
        req = { session: { user: { id: 'test_id' } }, flash: jest.fn() };
        res = { render: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
        next = jest.fn();
    });

    it('getAdminDashboard should handle errors', async () => {
        jest.spyOn(Contract, 'aggregate').mockRejectedValue(new Error('DB Error'));
        await homeController.getAdminDashboard(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('getPtDashboard should handle errors', async () => {
        jest.spyOn(WorkoutSession, 'find').mockImplementation(() => ({
            populate: jest.fn().mockRejectedValue(new Error('DB Error'))
        }));
        await homeController.getPtDashboard(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('getClientDashboard should handle errors', async () => {
        jest.spyOn(Contract, 'findOne').mockImplementation(() => ({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockRejectedValue(new Error('DB Error'))
        }));
        await homeController.getClientDashboard(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('getClientNutrition should handle errors', async () => {
        jest.spyOn(MealPlan, 'findOne').mockImplementation(() => ({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockRejectedValue(new Error('DB Error'))
        }));
        await homeController.getClientNutrition(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
