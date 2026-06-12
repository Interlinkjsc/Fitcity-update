const contractPauseService = require('../../src/modules/contracts/services/contractPauseService.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');

jest.mock('../../src/modules/contracts/models/contractModel.js');
jest.mock('../../src/modules/programs/models/workoutSessionModel.js');

describe('Contract Pause Service', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('pauseContract', () => {
        it('Should throw error if contract not found', async () => {
            Contract.findById.mockResolvedValue(null);
            await expect(contractPauseService.pauseContract('c1', 10, 'R')).rejects.toThrow('Hợp đồng không tồn tại');
        });

        it('Should throw if not Active', async () => {
            Contract.findById.mockResolvedValue({ contractStatus: 'Expired' });
            await expect(contractPauseService.pauseContract('c1', 10, 'R')).rejects.toThrow('Chỉ có thể bảo lưu');
        });

        it('Should throw if < 15 days left', async () => {
            const today = new Date();
            const closeEnd = new Date(today.getTime() + 86400000 * 5); // 5 days left
            Contract.findById.mockResolvedValue({ contractStatus: 'Active', endDate: closeEnd, currentEndDate: closeEnd });
            await expect(contractPauseService.pauseContract('c1', 10, 'R')).rejects.toThrow('ít nhất 15 ngày');
        });

        it('Should throw if invalid duration', async () => {
            const closeEnd = new Date(Date.now() + 86400000 * 30);
            Contract.findById.mockResolvedValue({ contractStatus: 'Active', endDate: closeEnd, pauseHistory: [] });
            await expect(contractPauseService.pauseContract('c1', 5, 'R')).rejects.toThrow('tối thiểu 7 ngày');
        });

        it('Should handle missing duration in pauseHistory (coverage edge case)', async () => {
            const closeEnd = new Date(Date.now() + 86400000 * 30);
            const contract = {
                _id: 'c1',
                contractStatus: 'Active',
                endDate: closeEnd,
                pauseHistory: [{ duration: null }], // fallback to 0
                save: jest.fn().mockResolvedValue(true)
            };
            Contract.findById.mockResolvedValue(contract);
            await contractPauseService.pauseContract('c1', 10, 'R');
            expect(contract.pauseHistory.length).toBe(2);
        });

        it('Should throw if total paused > 60', async () => {
            const closeEnd = new Date(Date.now() + 86400000 * 30);
            Contract.findById.mockResolvedValue({ 
                contractStatus: 'Active', 
                endDate: closeEnd, 
                currentEndDate: closeEnd,
                pauseHistory: [{ duration: 55 }],
                save: jest.fn().mockResolvedValue(true)
            });
            await expect(contractPauseService.pauseContract('c1', 10, 'R')).rejects.toThrow('quá 60 ngày');
        });

        it('Should pause contract and cancel scheduled sessions', async () => {
            const contract = {
                _id: 'c1',
                contractStatus: 'Active',
                endDate: new Date(Date.now() + 86400000 * 30),
                pauseHistory: [],
                save: jest.fn().mockResolvedValue(true)
            };
            Contract.findById.mockResolvedValue(contract);
            WorkoutSession.updateMany.mockResolvedValue({ modifiedCount: 1 });

            const result = await contractPauseService.pauseContract('c1', 15, 'Holiday');

            expect(result.contractStatus).toBe('Paused');
            expect(result.pauseHistory[0].duration).toBe(15);
            expect(WorkoutSession.updateMany).toHaveBeenCalled();
            expect(contract.save).toHaveBeenCalled();
        });
    });

    describe('unpauseContract', () => {
        it('Should throw if not Paused', async () => {
            Contract.findById.mockResolvedValue({ contractStatus: 'Active' });
            await expect(contractPauseService.unpauseContract('c1')).rejects.toThrow('không ở trạng thái bảo lưu');
        });

        it('Should throw if no pause history', async () => {
            Contract.findById.mockResolvedValue({ contractStatus: 'Paused', pauseHistory: [] });
            await expect(contractPauseService.unpauseContract('c1')).rejects.toThrow('không hợp lệ');
        });

        it('Should unpause and extend endDate', async () => {
            const originalEnd = new Date(Date.now() + 86400000 * 30);
            // Paused 10 days ago
            const pauseStart = new Date();
            pauseStart.setDate(pauseStart.getDate() - 10);
            
            const contract = {
                _id: 'c1',
                contractStatus: 'Paused',
                endDate: originalEnd,
                pauseHistory: [{ startDate: pauseStart }],
                save: jest.fn().mockReturnThis()
            };
            contract.save.mockResolvedValue(contract);
            Contract.findById.mockResolvedValue(contract);

            const result = await contractPauseService.unpauseContract('c1');
            
            expect(result.contractStatus).toBe('Active');
            expect(result.pauseHistory[0].endDate).toBeDefined();
            // Extension = 10 days (approx)
            expect(result.endDate.getTime()).toBeGreaterThan(originalEnd.getTime());
            expect(contract.save).toHaveBeenCalled();
        });

        it('Should handle unpause with future startDate (edge case for 100% coverage)', async () => {
            const future = new Date();
            future.setDate(future.getDate() + 1);

            const contract = {
                _id: 'c_future',
                contractStatus: 'Paused',
                endDate: new Date(),
                pauseHistory: [{ startDate: future }]
            };
            contract.save = jest.fn().mockResolvedValue(contract);
            Contract.findById.mockResolvedValue(contract);

            const result = await contractPauseService.unpauseContract('c_future');
            expect(result.contractStatus).toBe('Active');
        });

        it('Should handle unpausing if actual pause days < 0 (early manual unpause)', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const mockContract = {
                _id: 'c_early',
                contractStatus: 'Paused',
                pauseHistory: [{
                    startDate: tomorrow,
                    endDate: new Date(tomorrow.getTime() + 86400000 * 7),
                    duration: 7
                }],
                save: jest.fn().mockImplementation(function() { return Promise.resolve(this); }),
                endDate: new Date()
            };
            Contract.findById.mockResolvedValue(mockContract);
            const result = await contractPauseService.unpauseContract('c_early');
            expect(result.contractStatus).toBe('Active');
            expect(mockContract.pauseHistory[0].duration).toEqual(0);
        });
    });
});
