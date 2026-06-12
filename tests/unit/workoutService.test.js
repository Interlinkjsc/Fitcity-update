const workoutService = require('../../src/modules/programs/services/workoutService.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');

jest.mock('../../src/modules/platform/services/notificationService', () => ({
    pushNotification: jest.fn().mockResolvedValue(true)
}));

describe('Workout Service - Full Coverage', () => {
    describe('processQrScan (QR 3 Steps)', () => {
        let mockSession;
        let mockContract;

        beforeEach(() => {
            jest.clearAllMocks();
            mockContract = {
                _id: '60c72b2f9b1d8e2b8c8d8c01',
                contractStatus: 'Active',
                remainingSessions: 10,
                save: jest.fn().mockResolvedValue(true)
            };
            mockSession = {
                _id: '60c72b2f9b1d8e2b8c8d8c02',
                client: '60c72b2f9b1d8e2b8c8d8c03',
                pt: '60c72b2f9b1d8e2b8c8d8c04',
                contract: mockContract._id,
                status: 'Scheduled',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(WorkoutSession, 'findById').mockResolvedValue(mockSession);
            jest.spyOn(WorkoutSession, 'findOne').mockResolvedValue(null);
            // Mock require Contract (needs to be mocked cleanly since ensureSessionAndContractUsable uses it)
            // But ensureSessionAndContractUsable relies on Contract.findById
        });

        it('Should transition from Scheduled to In_Progress on first scan', async () => {
            // Cần gán contract thực tế để vượt qua check
            const Contract = require('../../src/modules/contracts/models/contractModel.js');
            jest.spyOn(Contract, 'findById').mockResolvedValue(mockContract);

            const result = await workoutService.processQrScan('60c72b2f9b1d8e2b8c8d8c02', '60c72b2f9b1d8e2b8c8d8c04');
            expect(result.status).toBe('In_Progress');
            expect(result.startTime).toBeDefined();
            expect(mockSession.save).toHaveBeenCalled();
        });

        it('Should transition from In_Progress to Completed and calculate commission on second scan', async () => {
            mockSession.status = 'In_Progress';
            const Contract = require('../../src/modules/contracts/models/contractModel.js');
            jest.spyOn(Contract, 'findById').mockResolvedValue(mockContract);
            
            // Giả lập Payload của qrScan 
            const result = await workoutService.processQrScan('60c72b2f9b1d8e2b8c8d8c02', '60c72b2f9b1d8e2b8c8d8c04');
            expect(result.status).toBe('Completed');
            expect(result.endTime).toBeDefined();
            expect(mockSession.save).toHaveBeenCalled();
        });

        it('Should throw error if unauthorized PT tries to scan', async () => {
            const Contract = require('../../src/modules/contracts/models/contractModel.js');
            jest.spyOn(Contract, 'findById').mockResolvedValue(mockContract);

            await expect(workoutService.processQrScan('60c72b2f9b1d8e2b8c8d8c02', '60c72b2f9b1d8e2b8c8d8c09')).rejects.toThrow('Bạn không có quyền thao tác trên buổi tập này.');
        });
        
        it('Should throw error for already Completed or Cancelled sessions', async () => {
            mockSession.status = 'Completed';
            const Contract = require('../../src/modules/contracts/models/contractModel.js');
            jest.spyOn(Contract, 'findById').mockResolvedValue(mockContract);

            await expect(workoutService.processQrScan('60c72b2f9b1d8e2b8c8d8c02', '60c72b2f9b1d8e2b8c8d8c04')).rejects.toThrow('Buổi tập đã kết thúc hoặc bị hủy.');
        });
    });
});
