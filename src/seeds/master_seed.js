const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../modules/users/models/userModel.js');
const Branch = require('../modules/crm/models/branchModel.js');
const ServicePackage = require('../modules/programs/models/servicePackageModel.js');
const Contract = require('../modules/contracts/models/contractModel.js');
const WorkoutSession = require('../modules/programs/models/workoutSessionModel.js');
const Lead = require('../modules/crm/models/leadModel.js');
const Coupon = require('../modules/finance/models/couponModel.js');
const Expense = require('../modules/finance/models/expenseModel.js');
const MealPlan = require('../modules/programs/models/mealPlanModel.js');
const PauseRequest = require('../modules/contracts/models/pauseRequestModel.js');
const Payroll = require('../modules/finance/models/payrollModel.js');
const BodyMetric = require('../modules/programs/models/bodyMetricModel.js');
const Notification = require('../modules/platform/models/notificationModel.js');
const { hash } = require('../utils/encryption');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB for E2E seeding...');

        // ============================================================
        //  STEP 0: CLEANUP — xoá dữ liệu cũ liên quan E2E
        // ============================================================
        const emailsToClear = [
            'admin@fitcity.com', 'marcus@fitcity.com', 'jd@user.com',
            'sales01@fitcity.com', 'manager01@fitcity.com', 'client02@user.com'
        ];
        const existingUsers = await User.find({ emailHash: { $in: emailsToClear.map(e => hash(e)) } });
        const existingIds = existingUsers.map(u => u._id);

        await Contract.deleteMany({ $or: [{ client: { $in: existingIds } }, { sales: { $in: existingIds } }] });
        await WorkoutSession.deleteMany({ $or: [{ client: { $in: existingIds } }, { pt: { $in: existingIds } }] });
        await MealPlan.deleteMany({ $or: [{ client: { $in: existingIds } }, { pt: { $in: existingIds } }] });
        await PauseRequest.deleteMany({ client: { $in: existingIds } });
        await Payroll.deleteMany({ staff: { $in: existingIds } });
        await BodyMetric.deleteMany({ $or: [{ client: { $in: existingIds } }, { pt: { $in: existingIds } }] });
        await Notification.deleteMany({ $or: [{ recipient: { $in: existingIds } }, { sender: { $in: existingIds } }] });
        await Expense.deleteMany({ recordedBy: { $in: existingIds } });
        await User.deleteMany({ emailHash: { $in: emailsToClear.map(e => hash(e)) } });
        await Branch.deleteMany({ name: { $in: ['FitCity District 1', 'FitCity District 7'] } });
        await ServicePackage.deleteMany({ name: { $in: ['Personal Training Elite 10', 'Gym Basic Monthly', 'Yoga Relax 20'] } });
        await Coupon.deleteMany({ code: { $in: ['WELCOME10', 'SUMMER50K', 'VIP20'] } });
        await Lead.deleteMany({});
        console.log('Cleanup done');

        // ============================================================
        //  STEP 1: BRANCHES (2 chi nhánh)
        // ============================================================
        const branch1 = await Branch.create({
            name: 'FitCity District 1',
            address: '123 Lê Lợi, Quận 1, TP.HCM',
            phone: '0901234567',
            location: { latitude: 10.7725, longitude: 106.6988 },
            operatingHours: { open: '06:00', close: '22:00' },
            status: 'Open'
        });
        const branch2 = await Branch.create({
            name: 'FitCity District 7',
            address: '456 Nguyễn Hữu Thọ, Quận 7, TP.HCM',
            phone: '0907654321',
            location: { latitude: 10.7324, longitude: 106.7218 },
            operatingHours: { open: '05:30', close: '23:00' },
            status: 'Open'
        });
        console.log('✅ 2 Branches created');

        // ============================================================
        //  STEP 2: USERS (6 users — SA, Manager, PT, Sales, 2 Clients)
        // ============================================================
        const sa = await User.create({
            name: 'System Admin',
            email: 'admin@fitcity.com',
            password: '123456',
            role: 'SA',
            status: 'Active'
        });

        const manager = await User.create({
            name: 'Nguyễn Văn Quản',
            email: 'manager01@fitcity.com',
            password: '123456',
            role: 'Manager',
            branch: branch1._id,
            status: 'Active',
            baseSalary: 8000000
        });

        const pt = await User.create({
            name: 'Marcus Thorne',
            email: 'marcus@fitcity.com',
            password: '123456',
            role: 'PT',
            branch: branch1._id,
            status: 'Active',
            baseSalary: 5000000
        });

        const sales = await User.create({
            name: 'Trần Thị Bán',
            email: 'sales01@fitcity.com',
            password: '123456',
            role: 'Sales',
            branch: branch1._id,
            status: 'Active',
            baseSalary: 5000000,
            salesCommissionRate: 5
        });

        const client1 = await User.create({
            name: 'Johnathan Doe',
            email: 'jd@user.com',
            password: '123456',
            role: 'Client',
            branch: branch1._id,
            status: 'Active'
        });

        const client2 = await User.create({
            name: 'Lê Thị Mai',
            email: 'client02@user.com',
            password: '123456',
            role: 'Client',
            branch: branch2._id,
            status: 'Active'
        });
        console.log('✅ 6 Users created (SA, Manager, PT, Sales, 2 Clients)');

        // ============================================================
        //  STEP 3: SERVICE PACKAGES (3 gói tập)
        // ============================================================
        const pkgPT = await ServicePackage.create({
            name: 'Personal Training Elite 10',
            type: 'Gym',
            duration: 30,
            sessions: 10,
            price: 10000000,
            description: 'Gói PT Premium 10 buổi với HLV cá nhân'
        });
        const pkgGym = await ServicePackage.create({
            name: 'Gym Basic Monthly',
            type: 'Gym',
            duration: 30,
            sessions: 0,
            price: 1500000,
            description: 'Gói tập Gym tự do 30 ngày'
        });
        const pkgYoga = await ServicePackage.create({
            name: 'Yoga Relax 20',
            type: 'Pilates',
            duration: 60,
            sessions: 20,
            price: 5000000,
            description: 'Gói Yoga 20 buổi trong 60 ngày'
        });
        console.log('✅ 3 Service Packages created (PT, Gym, Yoga)');

        // ============================================================
        //  STEP 4: COUPONS (3 mã giảm giá)
        // ============================================================
        const coupon1 = await Coupon.create({
            code: 'WELCOME10',
            type: 'Percentage',
            value: 10,
            maxDiscount: 2000000,
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            usageLimit: 100,
            usageCount: 5,
            createdBy: sa._id,
            active: true
        });
        await Coupon.create({
            code: 'SUMMER50K',
            type: 'Fixed',
            value: 50000,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            usageLimit: 50,
            usageCount: 12,
            createdBy: sa._id,
            active: true
        });
        await Coupon.create({
            code: 'VIP20',
            type: 'Percentage',
            value: 20,
            maxDiscount: 5000000,
            startDate: new Date(),
            endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            usageLimit: 10,
            createdBy: sa._id,
            active: true
        });
        console.log('✅ 3 Coupons created');

        // ============================================================
        //  STEP 5: CONTRACTS (3 hợp đồng — PT, Gym, Yoga)
        // ============================================================
        const basePrice1 = 10000000, discount1 = 1000000, vat1 = 10;
        const net1 = basePrice1 - discount1;
        const total1 = Math.round(net1 * (1 + vat1 / 100));
        const contract1 = await Contract.create({
            client: client1._id,
            sales: sales._id,
            pt: pt._id,
            branch: branch1._id,
            servicePackage: pkgPT._id,
            packageSnapshot: {
                name: pkgPT.name,
                type: pkgPT.type,
                duration: pkgPT.duration,
                sessions: pkgPT.sessions,
                price: pkgPT.price,
                isCustom: false
            },
            basePrice: basePrice1, discount: discount1, vat: vat1,
            totalAmount: total1, netAmount: net1,
            totalSessions: 10, remainingSessions: 7,
            paymentStatus: 'Paid', contractStatus: 'Active',
            paidAmount: total1,
            startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            paymentMethods: ['Transfer'],
            coupon: coupon1._id
        });

        const basePrice2 = 1500000, discount2 = 0, vat2 = 10;
        const net2 = basePrice2 - discount2;
        const total2 = Math.round(net2 * (1 + vat2 / 100));
        const contract2 = await Contract.create({
            client: client2._id,
            sales: sales._id,
            branch: branch2._id,
            servicePackage: pkgGym._id,
            packageSnapshot: {
                name: pkgGym.name,
                type: pkgGym.type,
                duration: pkgGym.duration,
                sessions: pkgGym.sessions,
                price: pkgGym.price,
                isCustom: false
            },
            basePrice: basePrice2, discount: discount2, vat: vat2,
            totalAmount: total2, netAmount: net2,
            totalSessions: 0, remainingSessions: 0,
            paymentStatus: 'Deposit', contractStatus: 'Active',
            paidAmount: 800000,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            paymentMethods: ['Cash']
        });

        const basePrice3 = 5000000, discount3 = 500000, vat3 = 10;
        const net3 = basePrice3 - discount3;
        const total3 = Math.round(net3 * (1 + vat3 / 100));
        const contract3 = await Contract.create({
            client: client1._id,
            sales: sales._id,
            pt: pt._id,
            branch: branch1._id,
            servicePackage: pkgYoga._id,
            packageSnapshot: {
                name: pkgYoga.name,
                type: pkgYoga.type,
                duration: pkgYoga.duration,
                sessions: pkgYoga.sessions,
                price: pkgYoga.price,
                isCustom: false
            },
            basePrice: basePrice3, discount: discount3, vat: vat3,
            totalAmount: total3, netAmount: net3,
            totalSessions: 20, remainingSessions: 18,
            paymentStatus: 'Paid', contractStatus: 'Active',
            paidAmount: total3,
            startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000),
            paymentMethods: ['Card']
        });
        console.log('✅ 3 Contracts created (PT-Paid, Gym-Deposit, Yoga-Paid)');

        // ============================================================
        //  STEP 6: WORKOUT SESSIONS (5 buổi tập cho PT)
        // ============================================================
        const now = new Date();
        // 3 completed sessions (past)
        for (let i = 1; i <= 3; i++) {
            const scheduled = new Date(now.getTime() - i * 2 * 24 * 60 * 60 * 1000);
            await WorkoutSession.create({
                client: client1._id,
                pt: pt._id,
                branch: branch1._id,
                contract: contract1._id,
                scheduledTime: scheduled,
                startTime: scheduled,
                endTime: new Date(scheduled.getTime() + 60 * 60 * 1000),
                status: 'Completed',
                clientConfirmation: { time: new Date(scheduled.getTime() + 65 * 60 * 1000), isConfirmed: true },
                workoutPlan: `Buổi ${i}: Cardio + Strength Training`,
                feedback: { rating: 5, comment: 'Buổi tập rất hiệu quả!' }
            });
        }
        // 1 session TODAY (scheduled — for workflow check-in test)
        await WorkoutSession.create({
            client: client1._id,
            pt: pt._id,
            branch: branch1._id,
            contract: contract1._id,
            scheduledTime: new Date(now.getTime() + 60 * 60 * 1000), // TODAY later
            status: 'Scheduled',
            workoutPlan: 'Full body workout + Stretching'
        });

        // 1 MORE session TODAY (scheduled - for pt_client_interaction test)
        await WorkoutSession.create({
            client: client1._id, // Must be client1 because contract2 is Inactive (limit reached)
            pt: pt._id,
            branch: branch1._id,
            contract: contract1._id,
            scheduledTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // TODAY even later
            status: 'Scheduled',
            workoutPlan: 'Interaction Test Workout'
        });

        // 1 session TOMORROW
        await WorkoutSession.create({
            client: client1._id,
            pt: pt._id,
            branch: branch1._id,
            contract: contract1._id,
            scheduledTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            status: 'Scheduled',
            workoutPlan: 'Lower body + Core'
        });
        console.log('✅ 5 Workout Sessions created (3 completed, 1 today, 1 tomorrow)');

        // ============================================================
        //  STEP 7: BODY METRICS (3 lần đo chỉ số cơ thể)
        // ============================================================
        await BodyMetric.create({
            client: client1._id, pt: pt._id,
            date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            weight: 78, height: 175, bodyFat: 22, muscleMass: 32,
            visceralFat: 8, water: 55, bmi: 25.5,
            measurements: { chest: 98, waist: 84, hips: 96, bicep: 32, thigh: 54 },
            notes: 'Đo lần 1 — bắt đầu chương trình'
        });
        await BodyMetric.create({
            client: client1._id, pt: pt._id,
            date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
            weight: 76, height: 175, bodyFat: 20, muscleMass: 33,
            visceralFat: 7, water: 57,
            measurements: { chest: 97, waist: 81, hips: 95, bicep: 33, thigh: 55 },
            notes: 'Đo lần 2 — giảm 2kg mỡ, tăng cơ'
        });
        await BodyMetric.create({
            client: client1._id, pt: pt._id,
            date: now,
            weight: 74.5, height: 175, bodyFat: 18, muscleMass: 34,
            visceralFat: 6, water: 58,
            measurements: { chest: 96, waist: 78, hips: 94, bicep: 34, thigh: 56 },
            notes: 'Đo lần 3 — tiến bộ tốt!'
        });
        console.log('✅ 3 Body Metrics created');

        // ============================================================
        //  STEP 8: MEAL PLANS (1 thực đơn cho client)
        // ============================================================
        await MealPlan.create({
            client: client1._id,
            pt: pt._id,
            contract: contract1._id,
            startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000),
            goal: 'Weight Loss',
            dailyCalories: 1800,
            macros: { protein: 35, carbs: 35, fat: 30 },
            meals: [
                {
                    time: 'Bữa sáng (7:00)',
                    foodItems: [
                        { name: 'Yến mạch + chuối', quantity: '1 bát', calories: 350 },
                        { name: 'Trứng luộc', quantity: '2 quả', calories: 140 }
                    ],
                    notes: 'Ăn trong vòng 30 phút sau khi thức dậy'
                },
                {
                    time: 'Bữa trưa (12:00)',
                    foodItems: [
                        { name: 'Cơm gạo lứt', quantity: '1 chén', calories: 200 },
                        { name: 'Ức gà nướng', quantity: '150g', calories: 250 },
                        { name: 'Rau xào', quantity: '1 đĩa', calories: 100 }
                    ],
                    notes: 'Uống nhiều nước'
                },
                {
                    time: 'Bữa tối (18:30)',
                    foodItems: [
                        { name: 'Cá hồi áp chảo', quantity: '150g', calories: 300 },
                        { name: 'Salad rau xanh', quantity: '1 đĩa', calories: 80 }
                    ],
                    notes: 'Không ăn sau 20:00'
                }
            ],
            active: true
        });
        console.log('✅ 1 Meal Plan created');

        // ============================================================
        //  STEP 9: EXPENSES (4 khoản chi)
        // ============================================================
        await Expense.create({
            branch: branch1._id, category: 'Rent',
            amount: 30000000, date: new Date(now.getFullYear(), now.getMonth(), 1),
            description: 'Tiền thuê mặt bằng tháng ' + (now.getMonth() + 1),
            recordedBy: sa._id, status: 'Approved'
        });
        await Expense.create({
            branch: branch1._id, category: 'Electricity',
            amount: 5000000, date: new Date(now.getFullYear(), now.getMonth(), 5),
            description: 'Tiền điện tháng ' + (now.getMonth() + 1),
            recordedBy: manager._id, status: 'Approved'
        });
        await Expense.create({
            branch: branch1._id, category: 'Equipment',
            amount: 15000000, date: new Date(now.getFullYear(), now.getMonth(), 10),
            description: 'Mua thêm máy chạy bộ Technogym',
            recordedBy: sa._id, status: 'Pending'
        });
        await Expense.create({
            branch: branch2._id, category: 'Marketing',
            amount: 3000000, date: new Date(now.getFullYear(), now.getMonth(), 8),
            description: 'Quảng cáo Facebook Ads tháng ' + (now.getMonth() + 1),
            recordedBy: manager._id, status: 'Approved'
        });
        console.log('✅ 4 Expenses created');

        // ============================================================
        //  STEP 10: PAYROLL (2 bản lương)
        // ============================================================
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        await Payroll.create({
            staff: pt._id, month, year, period: 1,
            baseSalary: 5000000, commission: 450000,
            totalSalary: 5450000, status: 'Paid'
        });
        await Payroll.create({
            staff: sales._id, month, year, period: 2,
            baseSalary: 5000000, commission: Math.round(total1 * 0.05),
            totalSalary: 5000000 + Math.round(total1 * 0.05), status: 'Pending'
        });
        console.log('✅ 2 Payroll records created');

        // ============================================================
        //  STEP 11: PAUSE REQUESTS (1 yêu cầu bảo lưu)
        // ============================================================
        await PauseRequest.create({
            client: client2._id,
            contract: contract2._id,
            startDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
            durationDays: 14,
            reason: 'Đi công tác nước ngoài 2 tuần',
            status: 'Pending'
        });
        console.log('✅ 1 Pause Request created');

        // ============================================================
        //  STEP 12: LEADS (3 khách tiềm năng)
        // ============================================================
        await Lead.create({
            name: 'Hoàng Minh',
            phone: '0912333444', email: 'hoang@test.com',
            branch: branch1._id,
            interestedPackage: 'Gym', source: 'Website', status: 'F'
        });
        await Lead.create({
            name: 'Lê Thu Thảo',
            phone: '0988777666', email: 'thao@test.com',
            branch: branch1._id,
            interestedPackage: 'Yoga', source: 'Website', status: 'Contacted'
        });
        await Lead.create({
            name: 'Trần Văn Hùng',
            phone: '0977111222', email: 'hung@test.com',
            branch: branch2._id,
            interestedPackage: 'PT', source: 'Facebook', status: 'Signed'
        });
        console.log('✅ 3 Leads created');

        // ============================================================
        //  STEP 13: NOTIFICATIONS (4 thông báo)
        // ============================================================
        await Notification.create({
            recipient: client1._id, sender: pt._id,
            title: 'Buổi tập hôm nay',
            message: 'Bạn có buổi tập với PT Marcus lúc ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            type: 'Info', link: '/client/sessions', read: false
        });
        await Notification.create({
            recipient: client1._id, sender: sa._id,
            title: 'Chào mừng thành viên mới!',
            message: 'Chào mừng Johnathan Doe đến với FitCity! Chúc bạn có những buổi tập hiệu quả.',
            type: 'Success', read: true
        });
        await Notification.create({
            recipient: pt._id, sender: sa._id,
            title: 'Lương đã được phê duyệt',
            message: `Lương tháng ${month}/${year} đã được phê duyệt. Tổng thực nhận: 5,450,000 VNĐ.`,
            type: 'Success', link: '/pt/payroll', read: false
        });
        await Notification.create({
            recipient: sa._id, sender: client2._id,
            title: 'Yêu cầu bảo lưu mới',
            message: 'Lê Thị Mai yêu cầu bảo lưu hợp đồng Gym Basic 14 ngày.',
            type: 'Alert', link: '/admin/contracts/list', read: false
        });
        console.log('✅ 4 Notifications created');

        // ============================================================
        //  DONE
        // ============================================================
        console.log('\n========================================');
        console.log('🎉 MASTER SEED COMPLETED SUCCESSFULLY!');
        console.log('========================================');
        console.log('Accounts:');
        console.log('  SA:      admin@fitcity.com / 123456');
        console.log('  Manager: manager01@fitcity.com / 123456');
        console.log('  PT:      marcus@fitcity.com / 123456');
        console.log('  Sales:   sales01@fitcity.com / 123456');
        console.log('  Client1: jd@user.com / 123456');
        console.log('  Client2: client02@user.com / 123456');
        console.log('========================================\n');

        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding error:', err);
        process.exit(1);
    }
}

seed();
