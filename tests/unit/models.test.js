require('dotenv').config({ path: '.env.test' });
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/modules/users/models/userModel.js');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
    await ServicePackage.deleteMany({});
    await WorkoutSession.deleteMany({});
});

describe('Database Models Unit Tests (Sprint 1 - Task 2)', () => {
    
    describe('UserModel - Bank Information', () => {
        test('Should accept valid alphanumeric account numbers', async () => {
            const user = new User({
                name: 'Test Staff',
                email: 'staff@test.com',
                password: 'password123',
                role: 'PT',
                branch: new mongoose.Types.ObjectId(),
                bankInfo: {
                    bankName: 'Techcombank',
                    accountName: 'TEST STAFF',
                    accountNumber: '19031234567890'
                }
            });

            const savedUser = await user.save();
            expect(savedUser.bankInfo.bankName).toBe('Techcombank');
            expect(savedUser.bankInfo.accountNumber).toBe('19031234567890');
        });

        test('Should FAIL validation if account number contains special characters', async () => {
            const user = new User({
                name: 'Test Staff',
                email: 'staff2@test.com',
                password: 'password123',
                role: 'PT',
                branch: new mongoose.Types.ObjectId(),
                bankInfo: {
                    bankName: 'Vietcombank',
                    accountName: 'TEST STAFF',
                    accountNumber: '123-456-789' // Invalid format
                }
            });

            let error;
            try {
                await user.save();
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(error.errors['bankInfo.accountNumber'].message).toContain('Số tài khoản không hợp lệ');
        });

        test('Should FAIL validation if account number is too short', async () => {
            const user = new User({
                name: 'Test Staff',
                email: 'staff3@test.com',
                password: 'password123',
                role: 'PT',
                branch: new mongoose.Types.ObjectId(),
                bankInfo: {
                    bankName: 'Vietcombank',
                    accountName: 'TEST STAFF',
                    accountNumber: '12345' // Under 6 chars
                }
            });

            let error;
            try {
                await user.save();
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(error.errors['bankInfo.accountNumber'].message).toContain('Số tài khoản không hợp lệ');
        });
    });

    describe('ServicePackageModel - Target & Unlimited Options', () => {
        test('Should save successfully with target and isUnlimited fields', async () => {
            const sp = new ServicePackage({
                name: 'Gói Pilates Không Giới Hạn',
                type: 'Pilates',
                duration: 30,
                price: 1500000,
                target: 'Pilates',
                isUnlimited: true
            });

            const savedSP = await sp.save();
            expect(savedSP.isUnlimited).toBe(true);
            expect(savedSP.target).toBe('Pilates');
        });

        test('Should FAIL if target is not in enum list', async () => {
            const sp = new ServicePackage({
                name: 'Gói Chạy Bộ',
                type: 'Gym',
                duration: 30,
                price: 500000,
                target: 'Chạy Bộ' // Invalid enum value
            });

            let error;
            try {
                await sp.save();
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(error.errors.target).toBeDefined();
        });
    });

    describe('WorkoutSessionModel - QR Code Fields', () => {
        test('Should save QR Token and timestamps correctly', async () => {
            const session = new WorkoutSession({
                client: new mongoose.Types.ObjectId(),
                pt: new mongoose.Types.ObjectId(),
                contract: new mongoose.Types.ObjectId(),
                branch: new mongoose.Types.ObjectId(),
                scheduledTime: new Date(),
                status: 'Scheduled',
                qrCode: {
                    token: 'FITCITY-QR-12345',
                    expiresAt: new Date(Date.now() + 10 * 60000) // +10 minutes
                }
            });

            const savedSession = await session.save();
            expect(savedSession.qrCode.token).toBe('FITCITY-QR-12345');
            expect(savedSession.qrCode.expiresAt).toBeDefined();
        });
    });
});
