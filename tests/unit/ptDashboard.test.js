const mongoose = require('mongoose');
const { getPtDashboard } = require('../../src/modules/platform/controllers/homeController.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const Violation = require('../../src/modules/crm/models/violationModel.js');
const KPIConfig = require('../../src/modules/programs/models/kpiModel.js');

// Mock Dependencies
jest.mock('../../src/modules/programs/models/workoutSessionModel.js');
jest.mock('../../src/modules/contracts/models/contractModel.js');
jest.mock('../../src/modules/users/models/userModel.js');
jest.mock('../../src/modules/crm/models/violationModel.js');
jest.mock('../../src/modules/programs/models/kpiModel.js');

describe('PT Dashboard Controller - KPI Calculations', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        mockReq = {
            session: {
                user: { id: new mongoose.Types.ObjectId().toString() }
            }
        };
        mockRes = {
            render: jest.fn()
        };
        mockNext = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('Should correctly calculate and pass KPI metrics to the view', async () => {
        // 1. Mock roster (today's sessions)
        WorkoutSession.find.mockReturnValue({
            populate: jest.fn().mockResolvedValue([{ _id: 'session1' }, { _id: 'session2' }])
        });

        // 2. Mock pt user (for commission rate)
        User.findById.mockResolvedValue({ _id: mockReq.session.user.id, ptCommissionPerSession: 200000 });

        // 3. Mock completed sessions count
        WorkoutSession.countDocuments.mockResolvedValue(15);

        // 3b. Mock paid contracts this month — estimatedCommission is computed by summing
        // each contract's ptCommission field (payrollService.calculatePTCommissionFromContracts),
        // not sessions * rate, so the mock must return contracts totaling the expected commission.
        Contract.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ ptCommission: 3000000 }]) });

        // 4. Mock new contract revenue aggregation
        Contract.aggregate.mockResolvedValue([{ _id: null, totalRevenue: 15000000 }]);

        // 5. Mock KPIConfig.findOne and Violation.find (prevent real DB call)
        KPIConfig.findOne.mockResolvedValue(null);
        Violation.find.mockResolvedValue([]);

        await getPtDashboard(mockReq, mockRes, mockNext);

        expect(mockRes.render).toHaveBeenCalledWith('pt/dashboard', expect.objectContaining({
            estimatedCommission: 3000000, // 15 sessions * 200,000
            revenueTarget: 100000000,
            completedSessions: 15,
            newContractRevenue: 15000000,
            rosterCount: 2,
            roster: [{ _id: 'session1' }, { _id: 'session2' }]
        }));
    });

    it('Should handle gracefully when PT has no completed sessions and no revenue', async () => {
        WorkoutSession.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });
        User.findById.mockResolvedValue({ _id: mockReq.session.user.id, ptCommissionPerSession: 150000 });
        WorkoutSession.countDocuments.mockResolvedValue(0);
        Contract.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
        Contract.aggregate.mockResolvedValue([]); // No revenue this month

        // Mock KPIConfig.findOne and Violation.find (prevent real DB call)
        KPIConfig.findOne.mockResolvedValue(null);
        Violation.find.mockResolvedValue([]);

        await getPtDashboard(mockReq, mockRes, mockNext);

        expect(mockRes.render).toHaveBeenCalledWith('pt/dashboard', expect.objectContaining({
            estimatedCommission: 0,
            revenueTarget: 100000000,
            completedSessions: 0,
            newContractRevenue: 0,
            rosterCount: 0,
            roster: []
        }));
    });
});
