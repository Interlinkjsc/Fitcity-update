const authController = require('../../src/modules/auth/controllers/authController.js');
const ptController = require('../../src/modules/pt/controllers/ptController.js');
const metricController = require('../../src/modules/programs/controllers/metricController.js');
const mealPlanController = require('../../src/modules/programs/controllers/mealPlanController.js');
const leadController = require('../../src/modules/crm/controllers/leadController.js');
const userController = require('../../src/modules/users/controllers/userController.js');
const User = require('../../src/modules/users/models/userModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const BodyMetric = require('../../src/modules/programs/models/bodyMetricModel.js');
const MealPlan = require('../../src/modules/programs/models/mealPlanModel.js');
const Lead = require('../../src/modules/crm/models/leadModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const notificationService = require('../../src/modules/platform/services/notificationService.js');

jest.mock('../../src/modules/users/models/userModel.js');
jest.mock('../../src/modules/programs/models/workoutSessionModel.js');
jest.mock('../../src/modules/contracts/models/contractModel.js');
jest.mock('../../src/modules/programs/models/bodyMetricModel.js');
jest.mock('../../src/modules/programs/models/mealPlanModel.js');
jest.mock('../../src/modules/crm/models/leadModel.js');
jest.mock('../../src/modules/crm/models/branchModel.js');
jest.mock('../../src/modules/platform/services/notificationService.js');

describe('Unified Controllers Error Coverage', () => {
    let req, res, next;
    beforeEach(() => {
        req = { params: {}, body: {}, flash: jest.fn(), session: { user: { id: 'u1' } }, logout: jest.fn() };
        res = { render: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), clearCookie: jest.fn() };
        next = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    describe('authController Error Handling', () => {
        it('login general error should catch', async () => {
            User.findOne.mockReturnValue({ select: jest.fn().mockImplementation(() => { throw new Error('err'); }) });
            req.body = { email: 'e', password: 'p' };
            await authController.login(req, res);
            expect(req.flash).toHaveBeenCalled();
        });

        it('logout error should log', async () => {
            req.session.destroy = jest.fn(cb => cb(new Error('err')));
            authController.logout(req, res);
            expect(console.error).toHaveBeenCalled();
        });

        it('getProfile error', async () => {
            User.findById.mockReturnValue({ populate: jest.fn().mockImplementation(() => { throw new Error('err'); }) });
            await authController.getProfile(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('ptController Error Handling', () => {
        it('checkOutSession err', async () => {
            WorkoutSession.findById.mockImplementation(() => { throw new Error('err'); });
            await ptController.checkOutSession(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('metricController Error Handling', () => {
        it('getMyClientsForMetrics err', async () => {
            Contract.find.mockReturnValue({ populate: jest.fn().mockImplementation(() => { throw new Error('err'); }) });
            await metricController.getMyClientsForMetrics(req, res, next);
            expect(next).toHaveBeenCalled();
        });
        it('getAddMetricForm err', async () => {
            Contract.findOne.mockReturnValue({ populate: jest.fn().mockImplementation(() => { throw new Error('err'); }) });
            await metricController.getAddMetricForm(req, res, next);
            expect(next).toHaveBeenCalled();
        });
        it('saveBodyMetric err', async () => {
            BodyMetric.create.mockImplementation(() => { throw new Error('err'); });
            await metricController.saveBodyMetric(req, res, next);
            expect(next).toHaveBeenCalled();
        });
        it('getMyProgress err', async () => {
            BodyMetric.find.mockReturnValue({ sort: jest.fn().mockImplementation(() => { throw new Error('err'); }) });
            await metricController.getMyProgress(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('mealPlanController Error Handling', () => {
        it('getMyClientsMealPlans err', async () => {
            MealPlan.find.mockImplementation(() => { throw new Error('err'); });
            await mealPlanController.getMyClientsMealPlans(req, res, next);
            expect(next).toHaveBeenCalled();
        });
        it('getCreateForm err', async () => {
            Contract.find.mockImplementation(() => { throw new Error('err'); });
            await mealPlanController.getCreateForm(req, res, next);
            expect(next).toHaveBeenCalled();
        });
        it('saveMealPlan err', async () => {
            Contract.findById.mockImplementation(() => { throw new Error('err'); });
            await mealPlanController.saveMealPlan(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('leadController Error Handling', () => {
        it('getLandingPage redirects (landing trắng thay bằng web đen — không còn query Branch)', async () => {
            await leadController.getLandingPage(req, res, next);
            expect(res.redirect).toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();
        });
        it('getAllLeads err', async () => {
            Lead.find.mockReturnValue({ populate: jest.fn().mockReturnThis(), sort: jest.fn().mockImplementation(() => { throw new Error('err'); }) });
            await leadController.getAllLeads(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('userController More Error Handling', () => {
        it('getUserList err', async () => {
            User.find.mockReturnValue({ populate: jest.fn().mockReturnThis(), sort: jest.fn().mockImplementation(() => { throw new Error('err'); }) });
            await userController.getUserList(req, res, next);
            expect(next).toHaveBeenCalled();
        });
        it('getEditForm err', async () => {
            User.findById.mockImplementation(() => { throw new Error('err'); });
            await userController.getEditForm(req, res, next);
            expect(next).toHaveBeenCalled();
        });
        it('updateUser err', async () => {
            User.findOne.mockReturnValue(null);
            const mockUser = { save: jest.fn().mockImplementation(() => { throw new Error('err'); }) };
            User.findById.mockResolvedValue(mockUser);
            await userController.updateUser(req, res, next);
            expect(next).toHaveBeenCalled();
        });
        it('deleteUser err', async () => {
            User.findByIdAndDelete.mockImplementation(() => { throw new Error('err'); });
            await userController.deleteUser(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });
});
