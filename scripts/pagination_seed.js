const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
require('dotenv').config();

const User = require('../src/modules/users/models/userModel.js');
const Branch = require('../src/modules/crm/models/branchModel.js');
const ServicePackage = require('../src/modules/programs/models/servicePackageModel.js');
const Contract = require('../src/modules/contracts/models/contractModel.js');
const Lead = require('../src/modules/crm/models/leadModel.js');
const Coupon = require('../src/modules/finance/models/couponModel.js');
const Violation = require('../src/modules/crm/models/violationModel.js');
const Expense = require('../src/modules/finance/models/expenseModel.js');
const PtAvailabilitySlot = require('../src/modules/pt/models/ptAvailabilitySlotModel.js');
const PaymentTransaction = require('../src/modules/contracts/models/transactionModel.js');
const Payroll = require('../src/modules/finance/models/payrollModel.js');
const WorkoutSession = require('../src/modules/programs/models/workoutSessionModel.js');
const BodyMetric = require('../src/modules/programs/models/bodyMetricModel.js');
const Notification = require('../src/modules/platform/models/notificationModel.js');
const Reward = require('../src/modules/programs/models/rewardModel.js');
const KPI = require('../src/modules/programs/models/kpiModel.js');
const PTChangeRequest = require('../src/modules/pt/models/ptChangeRequestModel.js');
const PauseRequest = require('../src/modules/contracts/models/pauseRequestModel.js');
const MealPlan = require('../src/modules/programs/models/mealPlanModel.js');

async function seedPaginationData() {
    try {
        console.log('Connecting to DB: ' + process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB...');

        // 1. Create Branches
        let branches = await Branch.find();
        if (branches.length < 5) {
            console.log('Creating branches...');
            for (let i = 0; i < 5; i++) {
                await Branch.create({
                    name: `FitCity ${faker.location.city()}`,
                    address: faker.location.streetAddress(),
                    phone: '090' + faker.string.numeric(7),
                    status: 'Open'
                });
            }
            branches = await Branch.find();
        }

        // 2. Get or Create Users
        let staffUsers = await User.find({ role: { $in: ['PT', 'Sales', 'Manager', 'Accountant'] } }).limit(50);
        if (staffUsers.length < 20) {
            console.log('Seeding Staff (50)...');
            const roles = ['PT', 'Sales', 'Manager', 'Accountant'];
            for (let i = 0; i < 50; i++) {
                const role = faker.helpers.arrayElement(roles);
                const u = await User.create({
                    name: faker.person.fullName(),
                    email: `staff.ext.${Date.now()}.${i}@fitcity.test`,
                    password: 'password123',
                    role,
                    branch: faker.helpers.arrayElement(branches)._id,
                    status: 'Active'
                });
                staffUsers.push(u);
            }
        }

        let clients = await User.find({ role: 'Client' }).limit(50);
        if (clients.length < 20) {
            console.log('Seeding Clients (50)...');
            for (let i = 0; i < 50; i++) {
                const u = await User.create({
                    name: faker.person.fullName(),
                    email: `client.ext.${Date.now()}.${i}@fitcity.test`,
                    password: 'password123',
                    role: 'Client',
                    branch: faker.helpers.arrayElement(branches)._id,
                    status: 'Active'
                });
                clients.push(u);
            }
        }

        // 3. Create Leads
        console.log('Seeding Leads (30)...');
        for (let i = 0; i < 30; i++) {
            await Lead.create({
                name: faker.person.fullName(),
                phone: '09' + faker.string.numeric(8),
                email: faker.internet.email(),
                interestedPackage: faker.helpers.arrayElement(['Gym', 'Yoga', 'PT', 'Kickfit', 'Pilates']),
                branch: faker.helpers.arrayElement(branches)._id,
                source: faker.helpers.arrayElement(['Website', 'Facebook', 'Referral', 'Walk-in']),
                status: faker.helpers.arrayElement(['F', 'Contacted', 'Signed'])
            });
        }

        // 4. Create Coupons
        console.log('Seeding Coupons (20)...');
        for (let i = 0; i < 20; i++) {
            await Coupon.create({
                code: 'FEST' + faker.string.alphanumeric(6).toUpperCase(),
                type: faker.helpers.arrayElement(['Percentage', 'Fixed']),
                value: faker.number.int({ min: 10, max: 1000000 }),
                endDate: faker.date.future(),
                usageLimit: 100,
                active: true
            });
        }

        // 5. Create Violations
        console.log('Seeding Violations (20)...');
        const manager = staffUsers.find(u => u.role === 'Manager') || staffUsers[0];
        for (let i = 0; i < 20; i++) {
            await Violation.create({
                staff: faker.helpers.arrayElement(staffUsers)._id,
                type: faker.helpers.arrayElement(['Đi trễ', 'Vắng mặt không phép', 'Thái độ không tốt', 'Vi phạm nội quy']),
                description: faker.lorem.sentence(),
                penaltyAmount: faker.number.int({ min: 50000, max: 500000 }),
                date: faker.date.recent({ days: 60 }),
                loggedBy: manager._id,
                status: 'Pending'
            });
        }

        // 6. Create Service Packages
        console.log('Seeding Packages (10)...');
        let pkgs = await ServicePackage.find();
        if (pkgs.length < 5) {
            const packageTypes = ['Gym', 'Gym Kids', 'Pilates'];
            for (let i = 0; i < 10; i++) {
                const p = await ServicePackage.create({
                    name: `Pack ${faker.commerce.productName()}`,
                    type: faker.helpers.arrayElement(packageTypes),
                    duration: faker.helpers.arrayElement([30, 90, 180, 365]),
                    sessions: faker.helpers.arrayElement([10, 20, 50, 100]),
                    price: faker.number.int({ min: 1000000, max: 15000000 }),
                    status: 'Active'
                });
                pkgs.push(p);
            }
        }

        // 7. Create Contracts
        console.log('Seeding Contracts (30)...');
        const sales = staffUsers.find(u => u.role === 'Sales') || staffUsers[0];
        const pt = staffUsers.find(u => u.role === 'PT') || staffUsers[0];
        const contracts = [];
        for (let i = 0; i < 30; i++) {
            const p = faker.helpers.arrayElement(pkgs);
            const client = faker.helpers.arrayElement(clients);
            const c = await Contract.create({
                client: client._id,
                servicePackage: p._id,
                branch: faker.helpers.arrayElement(branches)._id,
                sales: sales._id,
                pt: pt._id,
                startDate: faker.date.past(),
                endDate: faker.date.future(),
                basePrice: p.price,
                totalAmount: p.price * 1.1,
                paidAmount: p.price * 0.5,
                paymentStatus: 'Deposit',
                contractStatus: 'Active'
            });
            contracts.push(c);
        }

        // 8. Create Expenses
        console.log('Seeding Expenses (20)...');
        const expenseCats = ['Rent', 'Electricity', 'Water', 'Equipment', 'Maintenance', 'Marketing', 'Supplies', 'Other'];
        for (let i = 0; i < 20; i++) {
            await Expense.create({
                title: `Expense ${faker.commerce.product()}`,
                amount: faker.number.int({ min: 200000, max: 10000000 }),
                category: faker.helpers.arrayElement(expenseCats),
                branch: faker.helpers.arrayElement(branches)._id,
                date: faker.date.recent({ days: 90 }),
                recordedBy: manager._id
            });
        }

        // 9. Create Slot Requests
        console.log('Seeding Slots (20)...');
        const pts = staffUsers.filter(u => u.role === 'PT');
        for (let i = 0; i < 20; i++) {
            await PtAvailabilitySlot.create({
                pt: faker.helpers.arrayElement(pts)._id,
                branch: faker.helpers.arrayElement(branches)._id,
                startTime: faker.date.future(),
                durationMinutes: 60,
                status: 'Pending',
                pending: {
                    type: 'Book',
                    client: faker.helpers.arrayElement(clients)._id,
                    requestedAt: new Date(),
                    note: 'Slot seeding'
                }
            });
        }

        // 10. Create Transactions
        console.log('Seeding Transactions (20)...');
        for (let i = 0; i < 20; i++) {
            const c = faker.helpers.arrayElement(contracts);
            await PaymentTransaction.create({
                contractId: c._id,
                clientId: c.client,
                amount: faker.number.int({ min: 500000, max: 5000000 }),
                transactionType: faker.helpers.arrayElement(['Deposit', 'Installment', 'Balance_Payment']),
                paymentMethod: faker.helpers.arrayElement(['Cash', 'Transfer', 'Card']),
                status: 'Success',
                processedBy: faker.helpers.arrayElement(staffUsers)._id
            });
        }

        // 11. Create Workout Sessions
        console.log('Seeding Workout Sessions (50)...');
        for (let i = 0; i < 50; i++) {
            const c = faker.helpers.arrayElement(contracts);
            const start = faker.date.between({ from: '2026-05-01', to: '2026-05-20' });
            const end = new Date(start.getTime() + 60 * 60 * 1000); 
            await WorkoutSession.create({
                client: c.client,
                pt: c.pt,
                contract: c._id,
                branch: c.branch,
                scheduledTime: start,
                startTime: start,
                endTime: end,
                status: faker.helpers.arrayElement(['Scheduled', 'Completed', 'Cancelled']),
                notes: faker.lorem.sentence()
            });
        }

        // 12. Create Meal Plans
        console.log('Seeding Meal Plans (20)...');
        for (let i = 0; i < 20; i++) {
            const c = faker.helpers.arrayElement(contracts);
            await MealPlan.create({
                client: c.client,
                pt: c.pt,
                contract: c._id,
                startDate: faker.date.recent(),
                endDate: faker.date.future(),
                goal: faker.helpers.arrayElement(['Weight Loss', 'Muscle Gain', 'Maintenance', 'Endurance']),
                dailyCalories: faker.number.int({ min: 1500, max: 3500 }),
                macros: {
                    protein: 30,
                    carbs: 40,
                    fat: 30
                },
                meals: [
                    {
                        time: '08:00 AM',
                        foodItems: [{ name: 'Oatmeal', quantity: '100g', calories: 350 }],
                        notes: 'Breakfast'
                    },
                    {
                        time: '12:00 PM',
                        foodItems: [{ name: 'Chicken Breast', quantity: '200g', calories: 400 }],
                        notes: 'Lunch'
                    }
                ]
            });
        }

        // 13. Create Body Metrics
        console.log('Seeding Body Metrics (30)...');
        for (let i = 0; i < 30; i++) {
            const c = faker.helpers.arrayElement(contracts);
            await BodyMetric.create({
                client: c.client,
                pt: c.pt,
                weight: faker.number.int({ min: 50, max: 100 }),
                height: faker.number.int({ min: 150, max: 190 }),
                bodyFat: faker.number.int({ min: 10, max: 30 }),
                muscleMass: faker.number.int({ min: 20, max: 50 }),
                date: faker.date.recent()
            });
        }

        console.log('--- SEEDING COMPLETED ---');
        process.exit(0);
    } catch (err) {
        console.error('SEEDING ERROR:', err);
        process.exit(1);
    }
}

seedPaginationData();
