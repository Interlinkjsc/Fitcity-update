const mongoose = require('mongoose');
const contractService = require('../../src/modules/contracts/services/contractService.js');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const Coupon = require('../../src/modules/finance/models/couponModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const { addMonthsToDate, resolveDurationMonths } = require('../../src/utils/contractDurationHelper');

// MOCKING MONGOOSE FOR UNIT TESTING
jest.mock('../../src/modules/programs/models/servicePackageModel.js');
jest.mock('../../src/modules/contracts/models/contractModel.js');
jest.mock('../../src/modules/finance/models/couponModel.js');
jest.mock('../../src/modules/users/models/userModel.js');
jest.mock('../../src/modules/platform/services/systemSettingsService', () => ({
    getGlobalSettings: jest.fn().mockResolvedValue({
        defaultVat: 10,
        defaultPtCommissionRate: 10
    })
}));

describe('Contract Service - Unit Test', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateTotalAmount', () => {
        it('Should calculate correctly: (1,000,000 - 200,000) * 1.1 = 880,000', () => {
            const result = contractService.calculateTotalAmount(1000000, 200000, 10);
            expect(result).toBe(880000);
        });

        it('Should calculate correctly with zero discount', () => {
            const result = contractService.calculateTotalAmount(1000000, 0, 10);
            expect(result).toBe(1100000);
        });

        it('Should cap the discount at basePrice if higher', () => {
            const result = contractService.calculateTotalAmount(1000000, 1500000, 10);
            expect(result).toBe(0); // 1M - 1M = 0; 0 * 1.1 = 0
        });

        it('Should use default parameters correctly', () => {
            const result = contractService.calculateTotalAmount(1000000);
            expect(result).toBe(1100000); // 1M * 1.1
        });
    });

    describe('createContract', () => {
        it('Should create contract with auto-calculated endDate and totalAmount', async () => {
            const mockPackage = {
                _id: new mongoose.Types.ObjectId(),
                price: 50000000,
                duration: 365, // 1 Year
                sessions: 30, // Mock number of sessions
                name: 'Diamond Member'
            };
            
            // Setup Mocks
            ServicePackage.findById.mockResolvedValue(mockPackage);
            Contract.create.mockImplementation(data => Promise.resolve({ ...data, _id: 'mock_id' }));

            const contractInput = {
                packageId: mockPackage._id,
                clientId: new mongoose.Types.ObjectId(),
                branchId: new mongoose.Types.ObjectId(),
                salesId: new mongoose.Types.ObjectId(),
                discount: 5000000,
                startDate: new Date('2026-03-01T00:00:00Z')
            };

            const result = await contractService.createContract(contractInput);

            // Verification
            expect(ServicePackage.findById).toHaveBeenCalledWith(contractInput.packageId);
            expect(Contract.create).toHaveBeenCalled();
            
            // unit 50M/buổi × 30 buổi = 1.5B base; discount 5M → net 1.495B; VAT 10% → 1.6445B
            const expectedBase = 50000000 * 30;
            expect(result.basePrice).toBe(expectedBase);
            expect(result.netAmount).toBe(expectedBase - 5000000);
            expect(result.ptCommission).toBe(Math.round((expectedBase - 5000000) * 0.1));
            expect(result.totalAmount).toBe(Math.round((expectedBase - 5000000) * 1.1));
            expect(result.packageSnapshot.price).toBe(50000000);
            expect(result.totalSessions).toBe(mockPackage.sessions);
            expect(result.remainingSessions).toBe(mockPackage.sessions);
            
            // Check Dates: use same month-based logic as the code
            const durationMonths = resolveDurationMonths(mockPackage);
            const expectedEnd = addMonthsToDate(new Date('2026-03-01T00:00:00Z'), durationMonths);
            expect(result.endDate.toISOString()).toBe(expectedEnd.toISOString());
            
            expect(result.contractStatus).toBe('Draft');
        });

        it('Should throw error if package not found', async () => {
            ServicePackage.findById.mockResolvedValue(null);
            
            await expect(contractService.createContract({ packageId: 'bad_id' }))
                .rejects.toThrow('Gói tập không tồn tại');
        });

        it('Should apply Percentage Coupon correctly', async () => {
            const mockPackage = { _id: 'p1', price: 1000000, duration: 30, sessions: 10 };
            const mockCoupon = { 
                _id: 'c1', type: 'Percentage', value: 10, maxDiscount: 50000, 
                usageCount: 0, usageLimit: 10, save: jest.fn().mockResolvedValue(true) 
            };
            ServicePackage.findById.mockResolvedValue(mockPackage);
            Coupon.findOne.mockResolvedValue(mockCoupon);
            Contract.create.mockImplementation(d => d);

            const result = await contractService.createContract({ 
                packageId: 'p1', couponCode: 'SAVE10' 
            });

            expect(result.discount).toBe(50000); // 10% of 10M base, capped at 50k
            expect(result.basePrice).toBe(10000000);
            expect(mockCoupon.usageCount).toBe(1);
            expect(mockCoupon.save).toHaveBeenCalled();
        });

        it('Should apply Flat Coupon correctly', async () => {
            const mockPackage = { _id: 'p1', price: 1000000, duration: 30, sessions: 10 };
            const mockCoupon = { 
                _id: 'c2', type: 'Flat', value: 200000, 
                usageCount: 5, usageLimit: 10, save: jest.fn().mockResolvedValue(true) 
            };
            ServicePackage.findById.mockResolvedValue(mockPackage);
            Coupon.findOne.mockResolvedValue(mockCoupon);
            Contract.create.mockImplementation(d => d);

            const result = await contractService.createContract({ 
                packageId: 'p1', couponCode: 'FLAT200' 
            });

            expect(result.discount).toBe(200000);
        });

        it('Should throw error if coupon invalid', async () => {
            const mockPackage = { _id: 'p1', price: 1000000, duration: 30, sessions: 10 };
            ServicePackage.findById.mockResolvedValue(mockPackage);
            Coupon.findOne.mockResolvedValue(null);

            await expect(contractService.createContract({ 
                packageId: 'p1', couponCode: 'INVALID' 
            })).rejects.toThrow('Mã giảm giá không hợp lệ hoặc đã hết hạn');
        });

        it('Should reject FreeSessions coupon at contract creation', async () => {
            const mockPackage = { _id: 'p1', price: 1000000, duration: 30, sessions: 10 };
            const mockCoupon = {
                _id: 'c4',
                type: 'FreeSessions',
                value: 3,
                usageCount: 0,
                usageLimit: 10,
                save: jest.fn().mockResolvedValue(true)
            };
            ServicePackage.findById.mockResolvedValue(mockPackage);
            Coupon.findOne.mockResolvedValue(mockCoupon);

            await expect(
                contractService.createContract({
                    packageId: 'p1',
                    couponCode: 'GIFT3'
                })
            ).rejects.toThrow(/tặng buổi tập/);
            expect(mockCoupon.save).not.toHaveBeenCalled();
        });

        it('Should apply Percentage Coupon without maxDiscount cap', async () => {
            const mockPackage = { _id: 'p1', price: 1000000, duration: 30, sessions: 10 };
            const mockCoupon = { 
                _id: 'c3', type: 'Percentage', value: 10, maxDiscount: 0, 
                usageCount: 0, usageLimit: 1, save: jest.fn().mockResolvedValue(true) 
            };
            ServicePackage.findById.mockResolvedValue(mockPackage);
            Coupon.findOne.mockResolvedValue(mockCoupon);
            Contract.create.mockImplementation(d => d);

            const result = await contractService.createContract({ 
                packageId: 'p1', couponCode: 'PCT10' 
            });

            expect(result.discount).toBe(1000000); // 10% of 10M base, no cap
            expect(result.basePrice).toBe(10000000);
        });

        it('Should reject contract when sessions is zero', async () => {
            const mockPackage = { _id: 'p1', price: 1000000, duration: 30, sessions: 0 };
            ServicePackage.findById.mockResolvedValue(mockPackage);

            await expect(contractService.createContract({ packageId: 'p1' }))
                .rejects.toThrow(/số buổi tập/);
        });

        it('Should use PT profile ptCommissionRate when ptId is set', async () => {
            const ptId = new mongoose.Types.ObjectId();
            const mockPackage = { _id: 'p1', price: 1000000, duration: 30, sessions: 10 };
            ServicePackage.findById.mockResolvedValue(mockPackage);
            Contract.create.mockImplementation(d => d);
            User.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({ ptCommissionRate: 15 })
                })
            });

            const result = await contractService.createContract({
                packageId: 'p1',
                ptId
            });

            const net = 10000000;
            expect(result.ptCommission).toBe(Math.round(net * 0.15));
        });
    });

    describe('resolvePtCommissionRate', () => {
        it('prefers explicit rate over profile', async () => {
            const rate = await contractService.resolvePtCommissionRate('any', 12.5);
            expect(rate).toBe(12.5);
            expect(User.findById).not.toHaveBeenCalled();
        });

        it('loads rate from PT user', async () => {
            User.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({ ptCommissionRate: 8 })
                })
            });
            const rate = await contractService.resolvePtCommissionRate(new mongoose.Types.ObjectId());
            expect(rate).toBe(8);
        });
    });
});
