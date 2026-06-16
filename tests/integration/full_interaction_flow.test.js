
/**
 * BỘ TEST CASE TÍCH HỢP: TƯƠNG TÁC PT & CLIENT (FITCITY)
 * Bao gồm các trường hợp chuẩn và trường hợp biên (Edge Cases)
 */
const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');
const MealPlan = require('../../src/modules/programs/models/mealPlanModel.js');

describe('Full PT-Client Interaction Suite', () => {
    let pt, client, otherPt, branch, contract, pausedContract, exhaustedContract;
    let ptCookie, clientCookie, otherPtCookie, ptId, clientId, otherPtId;

    beforeAll(async () => {
        try {
            // Kết nối DB và chuẩn bị dữ liệu mẫu
            if (mongoose.connection.readyState === 0) {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity');
            }

            // 1. Dọn dẹp dữ liệu cũ (Nuclear Clean)
            const ptEmail = 'pt_test_flow@fitcity.com';
            const clientEmail = 'client_test_flow@fitcity.com';
            const otherPtEmail = 'other_pt_test_flow@fitcity.com';

            await User.deleteMany({});
            await Branch.deleteMany({});
            await ServicePackage.deleteMany({});
            await Contract.deleteMany({});
            await WorkoutSession.deleteMany({});
            await MealPlan.deleteMany({});

            // 2. Thiết lập Chi nhánh (Toạ độ Quận 1)
            branch = await Branch.create({
                name: 'Test Branch Flow',
                location: { latitude: 10.7719, longitude: 106.6983 },
                address: '123 District 1',
                phone: '0901234567',
                status: 'Open'
            });

            // 3. Thiết lập PT và Client
            pt = await User.create({ name: 'PT Master', email: ptEmail, password: 'password123', role: 'PT', branch: branch._id, status: 'Active' });
            otherPt = await User.create({ name: 'Other PT', email: otherPtEmail, password: 'password123', role: 'PT', branch: branch._id, status: 'Active' });
            client = await User.create({ name: 'VIP Client', email: clientEmail, password: 'password123', role: 'Client', branch: branch._id, status: 'Active' });

            ptId = pt._id;
            clientId = client._id;
            otherPtId = otherPt._id;

            const pkg = await ServicePackage.create({ name: 'Test Pack Flow', type: 'Gym', price: 1000000, duration: 30, sessions: 10 });

            // 4. Các loại Hợp đồng (Active, Paused, Exhausted)
            const pkgSnapshot = { name: 'Gói Test Flow', price: 1000000, duration: 30 };
            contract = await Contract.create({ 
                client: clientId, pt: ptId, branch: branch._id, servicePackage: pkg._id, 
                remainingSessions: 10, totalSessions: 10, contractStatus: 'Active', paymentStatus: 'Paid',
                startDate: new Date(), endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
                totalAmount: 1000000, basePrice: 1000000, netAmount: 1000000, paidAmount: 1000000, sales: ptId,
                packageSnapshot: pkgSnapshot
            });

            pausedContract = await Contract.create({ 
                client: clientId, pt: ptId, branch: branch._id, servicePackage: pkg._id, 
                remainingSessions: 5, totalSessions: 10, contractStatus: 'Paused', paymentStatus: 'Paid',
                startDate: new Date(), endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
                totalAmount: 1000000, basePrice: 1000000, netAmount: 1000000, paidAmount: 1000000, sales: ptId,
                packageSnapshot: pkgSnapshot
            });

            exhaustedContract = await Contract.create({ 
                client: clientId, pt: ptId, branch: branch._id, servicePackage: pkg._id, 
                remainingSessions: 0, totalSessions: 10, contractStatus: 'Active', paymentStatus: 'Paid',
                startDate: new Date(), endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
                totalAmount: 1000000, basePrice: 1000000, netAmount: 1000000, paidAmount: 1000000, sales: ptId,
                packageSnapshot: pkgSnapshot
            });

            // 5. Buổi tập mẫu
            // 6. Đăng nhập để lấy cookies
            const ptLogin = await request(app).post('/auth/login').send({ email: ptEmail, password: 'password123' });
            ptCookie = ptLogin.headers['set-cookie'];

            const clientLogin = await request(app).post('/auth/login').send({ email: clientEmail, password: 'password123' });
            clientCookie = clientLogin.headers['set-cookie'];

            const otherPtLogin = await request(app).post('/auth/login').send({ email: otherPtEmail, password: 'password123' });
            otherPtCookie = otherPtLogin.headers['set-cookie'];

        } catch (error) {
            console.error('❌ SETUP ERROR:', error);
            throw error;
        }
    });

    afterAll(async () => {
        // Cleanup and close
        await User.deleteMany({});
        await Branch.deleteMany({});
        await ServicePackage.deleteMany({});
        if (contract && pausedContract && exhaustedContract) {
            await Contract.deleteMany({ _id: { $in: [contract._id, pausedContract._id, exhaustedContract._id] } });
        }
        await WorkoutSession.deleteMany({});
        await MealPlan.deleteMany({});
        await mongoose.connection.close();
    });


    // --- NHÓM 1: LUỒNG DINH DƯỠNG (MEAL PLAN) ---
    describe('1. Meal Plan Flows', () => {
        test('TC-11: PT tạo thực đơn mới cho học viên', async () => {
            const res = await request(app)
                .post('/pt/meal-plans/store')
                .set('Cookie', ptCookie)
                .send({
                    contractId: contract._id,
                    goal: 'Muscle Gain',
                    calories: 2500,
                    protein: 40,
                    carbs: 40,
                    fat: 20,
                    mealsJson: JSON.stringify([
                        { time: 'Bữa sáng', foodItems: [{ name: 'Trứng, Yến mạch', quantity: '200g', calories: 450 }] },
                        { time: 'Bữa trưa', foodItems: [{ name: 'Bò bít tết', quantity: '300g', calories: 600 }] }
                    ])
                });
            
            expect(res.statusCode).toBe(302);
            const mp = await MealPlan.findOne({ contract: contract._id });
            expect(mp).toBeDefined();
            expect(mp.dailyCalories).toBe(2500);
        });

        test('TC-12: Hội viên truy cập Dashboard thấy báo cáo dinh dưỡng', async () => {
            // New meal plans start as status='pending_admin', active=false and are
            // only shown to the client once an Admin approves them. Simulate that
            // approval here (bypassing the HTTP approval flow, which needs a
            // separate Admin login) to test the actual current visibility rule.
            await MealPlan.updateOne(
                { contract: contract._id },
                { $set: { status: 'approved', active: true } }
            );

            const res = await request(app)
                .get('/client/nutrition')
                .set('Cookie', clientCookie);

            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Muscle Gain');
        });
    });

    // --- NHÓM 2: LUỒNG TRẠNG THÁI BIÊN (EDGE CASES) ---
    describe('2. Edge Cases & Constraints', () => {
        test('TC-14: PT khác không được sửa thực đơn khách hàng không phải của mình', async () => {
            // Thử lấy form tạo thực đơn cho client này bằng tài khoản otherPt
            const res = await request(app)
                .get('/pt/meal-plans/create')
                .set('Cookie', otherPtCookie);
            
            // Other PT sẽ không thấy contract của client này trong list contracts được gán
            expect(res.text).not.toContain(clientId.toString());
        });
    });
});
