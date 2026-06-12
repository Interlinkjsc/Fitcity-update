const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
require('dotenv').config();

const User = require('../src/modules/users/models/userModel.js');
const Branch = require('../src/modules/crm/models/branchModel.js');
const ServicePackage = require('../src/modules/programs/models/servicePackageModel.js');
const Contract = require('../src/modules/contracts/models/contractModel.js');
const WorkoutSession = require('../src/modules/programs/models/workoutSessionModel.js');
const BodyMetric = require('../src/modules/programs/models/bodyMetricModel.js');
const MealPlan = require('../src/modules/programs/models/mealPlanModel.js');
const PaymentTransaction = require('../src/modules/contracts/models/transactionModel.js');
const Notification = require('../src/modules/platform/models/notificationModel.js');
const PtAvailabilitySlot = require('../src/modules/pt/models/ptAvailabilitySlotModel.js');
const { hash } = require('../src/utils/encryption');

faker.seed(20260426);

const seedConfig = {
    branchName: 'E2E Faker Branch',
    packageName: 'E2E Faker PT Package',
    packageName2: 'E2E Faker Flex Package',
    packageName3: 'E2E Faker Legacy Package',
    users: {
        pt: { email: 'e2e.pt@fitcity.com', password: '123456', name: 'E2E PT' },
        sales: { email: 'e2e.sales@fitcity.com', password: '123456', name: 'E2E Sales' },
        client: { email: 'e2e.client@fitcity.com', password: '123456', name: 'E2E Client Main' },
        client2: { email: 'e2e.client2@fitcity.com', password: '123456', name: 'E2E Client Alt' },
        client3: { email: 'e2e.client3@fitcity.com', password: '123456', name: 'E2E Client Third' }
    },
    counts: {
        sessions: 120,
        slots: 96,
        metrics: 80,
        transactions: 12
    }
};

function atHour(date, hour, minute = 0) {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return d;
}

async function cleanupExistingSeed() {
    const emails = Object.values(seedConfig.users).map(u => u.email);
    const emailHashes = emails.map(e => hash(e));
    const existingUsers = await User.find({ emailHash: { $in: emailHashes } }).select('_id');
    const ids = existingUsers.map(u => u._id);

    if (ids.length > 0) {
        await PtAvailabilitySlot.deleteMany({ $or: [{ pt: { $in: ids } }, { 'pending.client': { $in: ids } }] });
        await WorkoutSession.deleteMany({ $or: [{ pt: { $in: ids } }, { client: { $in: ids } }] });
        await BodyMetric.deleteMany({ $or: [{ pt: { $in: ids } }, { client: { $in: ids } }] });
        await MealPlan.deleteMany({ $or: [{ pt: { $in: ids } }, { client: { $in: ids } }] });
        await PaymentTransaction.deleteMany({ $or: [{ clientId: { $in: ids } }, { processedBy: { $in: ids } }] });
        await Notification.deleteMany({ $or: [{ recipient: { $in: ids } }, { sender: { $in: ids } }] });
        await Contract.deleteMany({ $or: [{ pt: { $in: ids } }, { client: { $in: ids } }, { sales: { $in: ids } }] });
        await User.deleteMany({ _id: { $in: ids } });
    }

    await ServicePackage.deleteMany({ name: { $in: [seedConfig.packageName, seedConfig.packageName2, seedConfig.packageName3] } });
    await Branch.deleteMany({ name: seedConfig.branchName });
}

function buildMealPlanMeals(version = 1) {
    const baseMeals = [
        { title: 'Bữa sáng', time: '07:00', items: [['Yến mạch', '70g', 265], ['Trứng luộc', '2 quả', 140]] },
        { title: 'Bữa phụ', time: '10:00', items: [['Sữa chua Hy Lạp', '1 hũ', 120], ['Hạnh nhân', '15g', 85]] },
        { title: 'Bữa trưa', time: '12:30', items: [['Ức gà áp chảo', '180g', 300], ['Cơm gạo lứt', '150g', 170]] },
        { title: 'Bữa xế', time: '16:00', items: [['Chuối', '1 quả', 95], ['Whey Protein', '1 muỗng', 110]] },
        { title: 'Bữa tối', time: '19:00', items: [['Cá hồi', '150g', 300], ['Khoai lang', '180g', 155]] },
        { title: 'Trước ngủ', time: '22:00', items: [['Casein', '1 muỗng', 105], ['Kiwi', '1 quả', 45]] }
    ];

    return baseMeals.map((m, idx) => ({
        time: m.time,
        foodItems: m.items.map(([name, quantity, calories]) => ({ name, quantity, calories: calories + version * (idx % 2 === 0 ? 5 : -3) })),
        notes: version >= 3 && idx === 2 ? 'Ưu tiên chất xơ và rau xanh để ổn định tiêu hoá.' : undefined
    }));
}

function calcContractAmounts(basePrice, discount = 0, vat = 10) {
    const netAmount = Math.max(0, basePrice - discount);
    const totalAmount = Math.round(netAmount * (1 + vat / 100));
    return { netAmount, totalAmount };
}

function snapshotFromPackage(pkg) {
    return {
        name: pkg.name,
        type: pkg.type,
        duration: pkg.duration,
        durationMonths: pkg.durationMonths || Math.max(1, Math.ceil((pkg.duration || 30) / 30)),
        sessions: pkg.sessions ?? 0,
        price: pkg.price,
        isCustom: false
    };
}

async function assignReceiptNumbers(txDocs) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `RCP-${year}-${month}-`;
    const lastReceipt = await PaymentTransaction.findOne(
        { receiptNumber: new RegExp(`^${prefix}`) },
        { receiptNumber: 1 }
    ).sort({ receiptNumber: -1 }).lean();

    let sequence = 1;
    if (lastReceipt && lastReceipt.receiptNumber) {
        const parts = lastReceipt.receiptNumber.split('-');
        sequence = Number(parts[3]) + 1;
    }

    return txDocs.map((tx, idx) => ({
        ...tx,
        receiptNumber: `${prefix}${String(sequence + idx).padStart(4, '0')}`
    }));
}

async function runSeed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected DB. Start faker seeding...');

    await cleanupExistingSeed();

    const branch = await Branch.create({
        name: seedConfig.branchName,
        address: faker.location.streetAddress(),
        phone: '0909999999',
        location: { latitude: 10.7725, longitude: 106.6988 },
        operatingHours: { open: '06:00', close: '22:00' },
        status: 'Open'
    });

    const pt = await User.create({
        name: seedConfig.users.pt.name,
        email: seedConfig.users.pt.email,
        password: seedConfig.users.pt.password,
        role: 'PT',
        branch: branch._id,
        status: 'Active'
    });
    const sales = await User.create({
        name: seedConfig.users.sales.name,
        email: seedConfig.users.sales.email,
        password: seedConfig.users.sales.password,
        role: 'Sales',
        branch: branch._id,
        status: 'Active'
    });
    const client = await User.create({
        name: seedConfig.users.client.name,
        email: seedConfig.users.client.email,
        password: seedConfig.users.client.password,
        role: 'Client',
        branch: branch._id,
        status: 'Active'
    });
    const client2 = await User.create({
        name: seedConfig.users.client2.name,
        email: seedConfig.users.client2.email,
        password: seedConfig.users.client2.password,
        role: 'Client',
        branch: branch._id,
        status: 'Active'
    });
    const client3 = await User.create({
        name: seedConfig.users.client3.name,
        email: seedConfig.users.client3.email,
        password: seedConfig.users.client3.password,
        role: 'Client',
        branch: branch._id,
        status: 'Active'
    });

    const servicePackage = await ServicePackage.create({
        name: seedConfig.packageName,
        type: 'Gym',
        duration: 90,
        sessions: 120,
        sessionType: '1-1',
        price: 18000000,
        description: 'Seed package for large E2E flows',
        status: 'Active'
    });
    const servicePackage2 = await ServicePackage.create({
        name: seedConfig.packageName2,
        type: 'Gym',
        duration: 60,
        sessions: 50,
        sessionType: '1-1',
        price: 9800000,
        description: 'Secondary package for paused contract',
        status: 'Active'
    });
    const servicePackage3 = await ServicePackage.create({
        name: seedConfig.packageName3,
        type: 'Pilates',
        duration: 120,
        sessions: 80,
        sessionType: '1-1',
        price: 14500000,
        description: 'Legacy package for expired contract',
        status: 'Inactive'
    });

    const now = new Date();
    const activeStart = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
    const activeEnd = new Date(now.getTime() + 65 * 24 * 60 * 60 * 1000);
    const pausedStart = new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000);
    const pausedEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    const expiredStart = new Date(now.getTime() - 170 * 24 * 60 * 60 * 1000);
    const expiredEnd = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

    const activeAmounts = calcContractAmounts(18000000, 0, 10);
    const pausedAmounts = calcContractAmounts(9800000, 500000, 10);
    const expiredAmounts = calcContractAmounts(14500000, 1500000, 10);

    const activeContract = await Contract.create({
        client: client._id,
        servicePackage: servicePackage._id,
        packageSnapshot: snapshotFromPackage(servicePackage),
        branch: branch._id,
        sales: sales._id,
        pt: pt._id,
        startDate: activeStart,
        endDate: activeEnd,
        basePrice: 18000000,
        discount: 0,
        vat: 10,
        totalAmount: activeAmounts.totalAmount,
        netAmount: activeAmounts.netAmount,
        totalSessions: 120,
        remainingSessions: 82,
        paidAmount: activeAmounts.totalAmount,
        paymentStatus: 'Paid',
        contractStatus: 'Active',
        paymentMethods: ['Transfer']
    });
    const pausedContract = await Contract.create({
        client: client._id,
        servicePackage: servicePackage2._id,
        packageSnapshot: snapshotFromPackage(servicePackage2),
        branch: branch._id,
        sales: sales._id,
        pt: pt._id,
        startDate: pausedStart,
        endDate: pausedEnd,
        basePrice: 9800000,
        discount: 500000,
        vat: 10,
        totalAmount: pausedAmounts.totalAmount,
        netAmount: pausedAmounts.netAmount,
        totalSessions: 50,
        remainingSessions: 19,
        paidAmount: 5000000,
        paymentStatus: 'Deposit',
        contractStatus: 'Paused',
        paymentMethods: ['Cash', 'Transfer'],
        pauseHistory: [{
            startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
            endDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            reason: 'Đi công tác 1 tuần',
            duration: 7
        }]
    });
    const expiredContract = await Contract.create({
        client: client._id,
        servicePackage: servicePackage3._id,
        packageSnapshot: snapshotFromPackage(servicePackage3),
        branch: branch._id,
        sales: sales._id,
        pt: pt._id,
        startDate: expiredStart,
        endDate: expiredEnd,
        basePrice: 14500000,
        discount: 1500000,
        vat: 10,
        totalAmount: expiredAmounts.totalAmount,
        netAmount: expiredAmounts.netAmount,
        totalSessions: 80,
        remainingSessions: 0,
        paidAmount: expiredAmounts.totalAmount,
        paymentStatus: 'Paid',
        contractStatus: 'Expired',
        paymentMethods: ['Card']
    });

    // Sessions profile for main client (full journey)
    const sessionDocs = [];
    for (let i = 0; i < seedConfig.counts.sessions; i += 1) {
        const dayOffset = i - 90;
        const scheduled = atHour(new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000), faker.number.int({ min: 6, max: 20 }), faker.helpers.arrayElement([0, 30]));
        const status =
            i < 75 ? 'Completed' :
            (i < 100 ? 'Scheduled' :
                (i < 110 ? 'In_Progress' : 'Cancelled'));

        const completedButUnconfirmed = status === 'Completed' && i >= 70 && i <= 74;

        sessionDocs.push({
            client: client._id,
            pt: pt._id,
            contract: status === 'Completed' && i < 28 ? expiredContract._id : activeContract._id,
            branch: branch._id,
            scheduledTime: scheduled,
            startTime: (status === 'Completed' || status === 'In_Progress') ? scheduled : undefined,
            endTime: status === 'Completed' ? new Date(scheduled.getTime() + 60 * 60 * 1000) : undefined,
            status,
            workoutPlan: faker.helpers.arrayElement([
                'Strength + Mobility',
                'Cardio Intervals',
                'Upper Body Focus',
                'Lower Body + Core'
            ]),
            clientConfirmation: status === 'Completed'
                ? { isConfirmed: !completedButUnconfirmed, time: completedButUnconfirmed ? undefined : new Date(scheduled.getTime() + 65 * 60 * 1000) }
                : undefined
        });
    }
    // force one near-future scheduled for QR flow
    sessionDocs.push({
        client: client._id,
        pt: pt._id,
        contract: activeContract._id,
        branch: branch._id,
        scheduledTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        status: 'Scheduled',
        workoutPlan: 'E2E QR Target Session'
    });
    // force one current in-progress
    sessionDocs.push({
        client: client._id,
        pt: pt._id,
        contract: activeContract._id,
        branch: branch._id,
        scheduledTime: new Date(now.getTime() - 30 * 60 * 1000),
        startTime: new Date(now.getTime() - 30 * 60 * 1000),
        status: 'In_Progress',
        workoutPlan: 'E2E Active Session'
    });

    // Some sessions for other clients (environment realism)
    for (let i = 0; i < 15; i += 1) {
        const scheduled = atHour(new Date(now.getTime() + (i - 5) * 24 * 60 * 60 * 1000), 8 + (i % 5) * 2, 0);
        sessionDocs.push({
            client: i % 2 === 0 ? client2._id : client3._id,
            pt: pt._id,
            contract: activeContract._id,
            branch: branch._id,
            scheduledTime: scheduled,
            status: i < 9 ? 'Completed' : 'Scheduled',
            workoutPlan: 'Context Session'
        });
    }
    await WorkoutSession.insertMany(sessionDocs);

    // Slot profile for requests workflow (dense weekly board)
    const slotDocs = [];
    const baseMonday = new Date(now);
    const day = baseMonday.getDay() || 7;
    baseMonday.setDate(baseMonday.getDate() - day + 1);
    baseMonday.setHours(0, 0, 0, 0);
    for (let i = 0; i < seedConfig.counts.slots; i += 1) {
        const start = new Date(baseMonday);
        start.setDate(baseMonday.getDate() + Math.floor(i / 4));
        start.setHours(6 + (i % 4) * 3, 0, 0, 0);
        const status =
            i < 45 ? 'Open' :
            (i < 65 ? 'Pending' :
                (i < 90 ? 'Booked' : 'Closed'));

        const slot = {
            pt: pt._id,
            branch: branch._id,
            startTime: start,
            durationMinutes: 60,
            status
        };
        if (status === 'Pending') {
            const rejectNeeded = i % 6 === 0;
            slot.pending = {
                type: i % 2 === 0 ? 'Book' : 'Reschedule',
                client: i % 3 === 0 ? client._id : (i % 2 === 0 ? client2._id : client3._id),
                contract: activeContract._id,
                requestedAt: new Date(start.getTime() - 60 * 60 * 1000),
                note: 'E2E pending request'
            };
            if (rejectNeeded) {
                slot.status = 'Open';
                slot.decision = {
                    decidedBy: pt._id,
                    decidedAt: new Date(start.getTime() - 30 * 60 * 1000),
                    rejectReason: 'PT bận lịch đột xuất'
                };
            }
        }
        if (status === 'Booked') {
            slot.pending = {
                type: 'Book',
                client: i % 2 === 0 ? client._id : client2._id,
                contract: activeContract._id,
                requestedAt: new Date(start.getTime() - 90 * 60 * 1000),
                note: 'Booked slot'
            };
        }
        slotDocs.push(slot);
    }
    await PtAvailabilitySlot.insertMany(slotDocs, { ordered: false });

    // Body metrics for long-term progress
    const metricDocs = [];
    for (let i = 0; i < seedConfig.counts.metrics; i += 1) {
        const metricDate = new Date(now.getTime() - (seedConfig.counts.metrics - i) * 24 * 60 * 60 * 1000);
        const trendNoise = faker.number.float({ min: -0.25, max: 0.22, fractionDigits: 2 });
        const weight = Number((79 - i * 0.09 + trendNoise).toFixed(1));
        const bodyFat = Number((25 - i * 0.08 + faker.number.float({ min: -0.15, max: 0.12, fractionDigits: 2 })).toFixed(1));
        const muscle = Number((30 + i * 0.07 + faker.number.float({ min: -0.12, max: 0.16, fractionDigits: 2 })).toFixed(1));
        metricDocs.push({
            client: client._id,
            pt: pt._id,
            date: metricDate,
            weight,
            height: 175,
            bodyFat,
            muscleMass: muscle,
            water: Number((53 + i * 0.05).toFixed(1)),
            minerals: Number((3.2 + i * 0.01).toFixed(1)),
            protein: Number((16 + i * 0.03).toFixed(1)),
            notes: `E2E metric #${i + 1}`
        });
    }
    await BodyMetric.insertMany(metricDocs);

    // Meal plans (versioned)
    await MealPlan.insertMany([
        {
            client: client._id,
            pt: pt._id,
            contract: activeContract._id,
            startDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
            endDate: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000),
            goal: 'Weight Loss',
            dailyCalories: 2050,
            macros: { protein: 32, carbs: 33, fat: 25, fiber: 10 },
            meals: buildMealPlanMeals(1),
            active: false
        },
        {
            client: client._id,
            pt: pt._id,
            contract: activeContract._id,
            startDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
            endDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
            goal: 'Muscle Gain',
            dailyCalories: 2300,
            macros: { protein: 34, carbs: 36, fat: 20, fiber: 10 },
            meals: buildMealPlanMeals(2),
            active: true
        },
        {
            client: client._id,
            pt: pt._id,
            contract: activeContract._id,
            startDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
            endDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
            goal: 'Maintenance',
            dailyCalories: 2150,
            macros: { protein: 30, carbs: 35, fat: 25, fiber: 10 },
            meals: buildMealPlanMeals(3),
            active: false
        }
    ]);

    // Payment transactions (full payment + installments + pending)
    const txDocs = [];
    const paymentMethods = ['Cash', 'Transfer', 'Card'];

    const activeTxnAmounts = [5000000, 3800000, 4200000, 6800000];
    activeTxnAmounts.forEach((amount, idx) => {
        txDocs.push({
            contractId: activeContract._id,
            clientId: client._id,
            amount,
            transactionType: idx === 0 ? 'Deposit' : (idx === activeTxnAmounts.length - 1 ? 'Balance_Payment' : 'Installment'),
            paymentMethod: paymentMethods[idx % paymentMethods.length],
            status: 'Success',
            notes: `Active contract installment #${idx + 1}`,
            processedBy: sales._id,
            createdAt: new Date(now.getTime() - (40 - idx * 7) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now.getTime() - (40 - idx * 7) * 24 * 60 * 60 * 1000)
        });
    });

    const pausedTxnAmounts = [3000000, 2000000];
    pausedTxnAmounts.forEach((amount, idx) => {
        txDocs.push({
            contractId: pausedContract._id,
            clientId: client._id,
            amount,
            transactionType: idx === 0 ? 'Deposit' : 'Installment',
            paymentMethod: 'Transfer',
            status: idx === 1 ? 'Pending' : 'Success',
            notes: 'Paused contract partial payment',
            processedBy: sales._id,
            createdAt: new Date(now.getTime() - (65 - idx * 6) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now.getTime() - (65 - idx * 6) * 24 * 60 * 60 * 1000)
        });
    });

    const expiredTxnAmounts = [4000000, 3500000, 5500000, 1800000];
    expiredTxnAmounts.forEach((amount, idx) => {
        txDocs.push({
            contractId: expiredContract._id,
            clientId: client._id,
            amount,
            transactionType: idx === 0 ? 'Deposit' : (idx === expiredTxnAmounts.length - 1 ? 'Balance_Payment' : 'Installment'),
            paymentMethod: paymentMethods[(idx + 1) % paymentMethods.length],
            status: 'Success',
            notes: 'Expired contract history',
            processedBy: sales._id,
            createdAt: new Date(now.getTime() - (145 - idx * 12) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now.getTime() - (145 - idx * 12) * 24 * 60 * 60 * 1000)
        });
    });

    // Additional ambient transactions for other clients
    for (let i = txDocs.length; i < seedConfig.counts.transactions; i += 1) {
        txDocs.push({
            contractId: activeContract._id,
            clientId: i % 2 === 0 ? client2._id : client3._id,
            amount: faker.number.int({ min: 1000000, max: 3500000 }),
            transactionType: faker.helpers.arrayElement(['Deposit', 'Installment']),
            paymentMethod: faker.helpers.arrayElement(paymentMethods),
            status: faker.helpers.arrayElement(['Success', 'Pending']),
            notes: 'Ambient transaction',
            processedBy: sales._id
        });
    }
    const txDocsWithReceipt = await assignReceiptNumbers(txDocs);
    await PaymentTransaction.insertMany(txDocsWithReceipt);

    // Notifications for client/PT dashboards and bell states
    const notificationDocs = [
        {
            recipient: client._id,
            sender: pt._id,
            title: 'Buổi tập sắp diễn ra',
            message: 'Buổi tập với PT sẽ bắt đầu trong 2 giờ tới. Hãy sẵn sàng mã QR.',
            type: 'Info',
            link: '/client/workouts',
            read: false
        },
        {
            recipient: client._id,
            sender: pt._id,
            title: 'Yêu cầu đổi lịch đã được duyệt',
            message: 'PT đã duyệt yêu cầu đổi lịch của bạn.',
            type: 'Success',
            link: '/client/schedule',
            read: false
        },
        {
            recipient: client._id,
            sender: sales._id,
            title: 'Nhắc thanh toán đợt tiếp theo',
            message: 'Hợp đồng tạm dừng còn một khoản Pending, vui lòng hoàn tất để kích hoạt lại.',
            type: 'Warning',
            link: '/client/contracts',
            read: false
        },
        {
            recipient: client._id,
            sender: pt._id,
            title: 'Cập nhật meal plan',
            message: 'Meal plan tuần này đã được điều chỉnh theo mục tiêu tăng cơ.',
            type: 'Alert',
            link: '/client/nutrition',
            read: true
        },
        {
            recipient: client._id,
            sender: pt._id,
            title: 'Xác nhận buổi tập',
            message: 'Bạn có 1 buổi Completed cần xác nhận trong dashboard.',
            type: 'Info',
            link: '/client/dashboard',
            read: false
        },
        {
            recipient: pt._id,
            sender: client._id,
            title: 'Khách hàng gửi yêu cầu mới',
            message: 'Có yêu cầu đặt lịch mới từ khách hàng e2e.client@fitcity.com.',
            type: 'Info',
            link: '/pt/requests',
            read: false
        },
        {
            recipient: pt._id,
            sender: client2._id,
            title: 'Khách xác nhận lịch tập',
            message: 'Khách hàng đã xác nhận buổi tập ngày mai.',
            type: 'Success',
            link: '/pt/schedule',
            read: true
        }
    ];
    await Notification.insertMany(notificationDocs);

    console.log('========================================');
    console.log('E2E Faker FULL PROFILE seed completed');
    console.log(`Branch: ${seedConfig.branchName}`);
    console.log(`PT: ${seedConfig.users.pt.email} / ${seedConfig.users.pt.password}`);
    console.log(`Client1: ${seedConfig.users.client.email} / ${seedConfig.users.client.password}`);
    console.log(`Client2: ${seedConfig.users.client2.email} / ${seedConfig.users.client2.password}`);
    console.log(`Client3: ${seedConfig.users.client3.email} / ${seedConfig.users.client3.password}`);
    console.log(`Contracts: 3 (Active/Paused/Expired), Sessions: ${seedConfig.counts.sessions + 17}, Slots: ${seedConfig.counts.slots}, Metrics: ${seedConfig.counts.metrics}`);
    console.log(`MealPlans: 3 (versioned), Transactions: ${txDocsWithReceipt.length}`);
    console.log(`Notifications: ${notificationDocs.length} (read/unread mixed)`);
    console.log('========================================');
}

runSeed()
    .then(async () => {
        await mongoose.connection.close();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error('E2E faker seed failed:', err);
        try { await mongoose.connection.close(); } catch (e) {}
        process.exit(1);
    });

