/**
 * Home Controller Unit Tests (Mock DB calls)
 */
const homeController = require('../../src/modules/platform/controllers/homeController.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const Expense = require('../../src/modules/finance/models/expenseModel.js');
const MealPlan = require('../../src/modules/programs/models/mealPlanModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const KPIConfig = require('../../src/modules/programs/models/kpiModel.js');
const Violation = require('../../src/modules/crm/models/violationModel.js');
const Payroll = require('../../src/modules/finance/models/payrollModel.js');
const Reward = require('../../src/modules/programs/models/rewardModel.js');
const Lead = require('../../src/modules/crm/models/leadModel.js');
const DailyReport = require('../../src/modules/platform/models/dailyReportModel.js');
const kpiService = require('../../src/modules/platform/services/kpiService.js');
const mealLogService = require('../../src/modules/programs/services/mealLogService.js');

jest.mock('../../src/modules/programs/models/rewardModel.js');

describe('Home Controller', () => {
    jest.setTimeout(20000);

    const mockRes = () => {
        const res = {};
        res.render = jest.fn().mockReturnValue(res);
        return res;
    };

    afterEach(() => jest.restoreAllMocks());

    describe('getAdminDashboard', () => {
        it('Should render admin/dashboard with correct data', async () => {
            const aggregateMock = jest.spyOn(Contract, 'aggregate');
            aggregateMock.mockImplementationOnce(async () => [{ totalNet: 45000000, totalAfterTax: 50000000, totalPaid: 0, count: 1 }]); // revenue stats
            aggregateMock.mockImplementationOnce(async () => [{ _id: null, totalPending: 0 }]); // pending receivables
            aggregateMock.mockImplementationOnce(async () => []); // sales performance (empty)
            jest.spyOn(Expense, 'aggregate').mockResolvedValue([{ _id: null, total: 10000000 }]);
            jest.spyOn(User, 'countDocuments').mockResolvedValue(120);
            jest.spyOn(WorkoutSession, 'countDocuments').mockResolvedValue(45);
            jest.spyOn(Contract, 'countDocuments').mockResolvedValue(50);
            jest.spyOn(Contract, 'distinct').mockResolvedValue(['c1', 'c2', 'c3']);
            const mockBranches = [{ _id: '507f1f77bcf86cd799439021', name: 'Branch 1' }];
            const mockBranchQuery = {
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockBranches),
                then: (resolve) => Promise.resolve(mockBranches).then(resolve)
            };
            jest.spyOn(Branch, 'find').mockReturnValue(mockBranchQuery);
            jest.spyOn(KPIConfig, 'findOne').mockResolvedValue(null);
            jest.spyOn(Violation, 'countDocuments').mockResolvedValue(3);
            jest.spyOn(Violation, 'aggregate').mockResolvedValue([{ _id: null, total: 500000 }]);
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([])
            };
            jest.spyOn(Contract, 'find').mockReturnValue(mockQuery);
            jest.spyOn(WorkoutSession, 'aggregate').mockResolvedValue([]);
            jest.spyOn(Payroll, 'aggregate').mockResolvedValue([]);

            // Mock Lead.aggregate for the direct call in homeController (lead counts per sales)
            jest.spyOn(Lead, 'aggregate').mockResolvedValue([]);
            jest.spyOn(DailyReport, 'countDocuments').mockResolvedValue(10);
            // Mock kpiService.getBranchKPI to prevent real DB calls (Lead.countDocuments inside kpiService)
            jest.spyOn(kpiService, 'getBranchKPI').mockResolvedValue({
                revenueTarget: 0,
                revenueActual: 0,
                revenuePercent: 0,
                contractTarget: 0,
                contractActual: 0,
                contractPercent: 0,
                newLeadTarget: 0,
                newLeadActual: 0,
                leadPercent: 0
            });

            // Mock sessions collection (connect-mongo) — one Client session
            User.db = {
                collection: jest.fn().mockReturnValue({
                    find: jest.fn().mockReturnValue({
                        project: jest.fn().mockReturnValue({
                            toArray: jest.fn().mockResolvedValue([
                                { session: JSON.stringify({ user: { id: 'c1', role: 'Client' } }) },
                                { session: JSON.stringify({ user: { id: 'c1', role: 'Client' } }) },
                                { session: JSON.stringify({ user: { id: 'admin1', role: 'SA' } }) }
                            ])
                        })
                    })
                })
            };

            const req = { query: {}, session: { user: { role: 'Admin', id: '507f1f77bcf86cd799439011' } }, flash: jest.fn() };
            const res = mockRes();
            const next = jest.fn();

            await homeController.getAdminDashboard(req, res, next);

            // Debug: check if an error was thrown

            expect(res.render).toHaveBeenCalledWith('admin/dashboard', expect.objectContaining({
                totalRevenueAfterTax: 50000000,
                pendingReceivables: 0,
                activeMembers: 120,
                sessionsToday: 45,
                pendingContracts: [],
                activePage: 'dashboard'
            }));
        });

        it('Should call next(error) on DB failure', async () => {
            jest.spyOn(Contract, 'aggregate').mockRejectedValue(new Error('DB Down'));

            const req = {};
            const res = mockRes();
            const next = jest.fn();

            await homeController.getAdminDashboard(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('getClientDashboard', () => {
        it('Should render client/dashboard', async () => {
            const req = { session: { user: { role: 'Client', id: '507f1f77bcf86cd799439011' } } };
            const res = mockRes();
            const next = jest.fn();

            const mockContract = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue({ 
                    remainingSessions: 10, 
                    totalSessions: 22, 
                    totalSessions: 22,
                    servicePackage: { name: 'Premium' } 
                })
            };
            jest.spyOn(Contract, 'findOne').mockReturnValue(mockContract);

            jest.spyOn(WorkoutSession, 'countDocuments').mockResolvedValue(12);
            const findOneChain = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null)
            };
            jest.spyOn(WorkoutSession, 'findOne').mockReturnValue(findOneChain);
            jest.spyOn(MealPlan, 'findOne').mockReturnValue({
                sort: jest.fn().mockResolvedValue(null)
            });

            await homeController.getClientDashboard(req, res, next);
            
            expect(res.render).toHaveBeenCalledWith('client/dashboard', expect.objectContaining({
                sessionsCompleted: 12,
                totalSessions: 22
            }));
        });

        it('Should call next(error) on failure', async () => {
            const req = { session: { user: { id: '507f1f77bcf86cd799439011' } } };
            const res = { render: jest.fn(() => { throw new Error('Render failed'); }) };
            const next = jest.fn();
            
            jest.spyOn(Contract, 'findOne').mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue(null)
            });
            jest.spyOn(WorkoutSession, 'countDocuments').mockResolvedValue(0);

            await homeController.getClientDashboard(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('getPtDashboard', () => {
        it('Should render pt/dashboard', async () => {
            const req = { session: { user: { role: 'PT', id: '507f1f77bcf86cd799439012' } } };
            const res = mockRes();
            const next = jest.fn();

            jest.spyOn(WorkoutSession, 'find').mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            });
            jest.spyOn(WorkoutSession, 'countDocuments').mockResolvedValue(5);
            jest.spyOn(User, 'findById').mockResolvedValue({ ptCommissionPerSession: 100000, baseSalary: 5000000 });
            jest.spyOn(Contract, 'find').mockReturnValue({ select: jest.fn().mockResolvedValue([{ ptCommission: 500000 }]) });
            jest.spyOn(Contract, 'aggregate').mockResolvedValue([]);
            jest.spyOn(KPIConfig, 'findOne').mockResolvedValue(null);
            jest.spyOn(Violation, 'find').mockResolvedValue([]);

            await homeController.getPtDashboard(req, res, next);
            
            expect(res.render).toHaveBeenCalledWith('pt/dashboard', expect.objectContaining({
                estimatedCommission: 500000,
                rosterCount: 0
            }));
        });
    });

    describe('getClientNutrition', () => {
        it('Should render client/nutrition', async () => {
            const req = { session: { user: { id: 'client123' } } };
            const res = mockRes();
            const next = jest.fn();
            jest.spyOn(MealPlan, 'findOne').mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockResolvedValue(null)
                })
            });
            jest.spyOn(mealLogService, 'getLogsForDate').mockResolvedValue([]);
            jest.spyOn(mealLogService, 'getRecentLogs').mockResolvedValue([]);
            await homeController.getClientNutrition(req, res, next);
            expect(res.render).toHaveBeenCalledWith('client/nutrition', expect.any(Object));
        });
    });
});
