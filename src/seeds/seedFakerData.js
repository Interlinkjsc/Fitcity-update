const mongoose = require('mongoose');
const { fakerVI: faker } = require('@faker-js/faker');
const bcrypt = require('bcryptjs');

// Models
const User = require('../modules/users/models/userModel.js');
const Branch = require('../modules/crm/models/branchModel.js');
const ServicePackage = require('../modules/programs/models/servicePackageModel.js');
const Contract = require('../modules/contracts/models/contractModel.js');
const WorkoutSession = require('../modules/programs/models/workoutSessionModel.js');
const MealPlan = require('../modules/programs/models/mealPlanModel.js');
const Notification = require('../modules/platform/models/notificationModel.js');


const seedDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/crm_fitness');
        console.log('MongoDB connected.');

        // 1. Create a Branch
        let branch = await Branch.findOne({ name: 'FitCity Master Branch' });
        if (!branch) {
            branch = await Branch.create({
                name: 'FitCity Master Branch',
                address: faker.location.streetAddress(),
                phone: faker.phone.number(),
                manager: null
            });
        }

        // 2. Create Service Package
        let servicePackage = await ServicePackage.findOne({ name: 'E2E Faker PT Package' });
        if (!servicePackage) {
            servicePackage = await ServicePackage.create({
                name: 'E2E Faker PT Package',
                description: 'Full comprehensive PT training for testing',
                price: 15000000,
                sessionCount: 120,
                durationInDays: 365,
                status: 'Active'
            });
        }

        // 3. Create Users
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        await User.deleteMany({ email: { $in: ['faker_client@fitcity.com', 'faker_pt@fitcity.com'] } });

        const ptUser = await User.create({
            name: 'HLV E2E PT',
            email: 'faker_pt@fitcity.com',
            password: hashedPassword,
            role: 'PT',
            phone: faker.phone.number(),
            branch: branch._id,
            avatar: faker.image.avatar()
        });

        const clientUser = await User.create({
            name: 'Client Tester E2E',
            email: 'faker_client@fitcity.com',
            password: hashedPassword,
            role: 'Client',
            phone: faker.phone.number(),
            branch: branch._id,
            assignedPT: ptUser._id,
            avatar: faker.image.avatar()
        });

        // 4. Create Contract
        await Contract.deleteMany({ client: clientUser._id });
        const contract = await Contract.create({
            client: clientUser._id,
            pt: ptUser._id,
            servicePackage: servicePackage._id,
            branch: branch._id,
            startDate: new Date(),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            totalSessions: 120,
            usedSessions: 38,
            remainingSessions: 82,
            price: 15000000,
            discount: 0,
            finalPrice: 15000000,
            paidAmount: 15000000,
            paymentStatus: 'Paid',
            status: 'Active'
        });

        // 5. Create Workout Sessions
        await WorkoutSession.deleteMany({ contract: contract._id });

        // A Completed session waiting for confirmation
        const pastDate = new Date();
        pastDate.setHours(pastDate.getHours() - 2);
        await WorkoutSession.create({
            client: clientUser._id,
            pt: ptUser._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: pastDate,
            startTime: pastDate,
            endTime: new Date(pastDate.getTime() + 60 * 60 * 1000),
            status: 'Completed',
            clientConfirmation: {
                isConfirmed: false
            },
            workoutPlan: 'Leg day and core'
        });

        // An In_Progress session (needs End QR)
        const now = new Date();
        await WorkoutSession.create({
            client: clientUser._id,
            pt: ptUser._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: now,
            startTime: now,
            status: 'In_Progress',
            workoutPlan: 'Cardio & HIIT'
        });

        // A Scheduled session (needs Start QR)
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);
        await WorkoutSession.create({
            client: clientUser._id,
            pt: ptUser._id,
            contract: contract._id,
            branch: branch._id,
            scheduledTime: futureDate,
            status: 'Scheduled',
            workoutPlan: 'Upper body strength'
        });

        // 6. Create Meal Plan
        await MealPlan.deleteMany({ client: clientUser._id });
        await MealPlan.create({
            client: clientUser._id,
            pt: ptUser._id,
            contract: contract._id,
            startDate: new Date(),
            endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            goal: 'Weight Loss',
            dailyCalories: 1800,
            macros: {
                protein: 40,
                carbs: 30,
                fat: 20,
                fiber: 10
            },
            meals: [
                {
                    time: '08:00',
                    foodItems: [
                        { name: 'Oatmeal', quantity: '100g', calories: 350 },
                        { name: 'Eggs', quantity: '2', calories: 150 }
                    ],
                    notes: 'Eat slowly'
                },
                {
                    time: '12:30',
                    foodItems: [
                        { name: 'Chicken Breast', quantity: '200g', calories: 330 },
                        { name: 'Brown Rice', quantity: '1 cup', calories: 215 },
                        { name: 'Broccoli', quantity: '150g', calories: 50 }
                    ],
                    notes: 'Drink water'
                }
            ]
        });

        // 7. Create Notifications
        await Notification.deleteMany({ recipient: clientUser._id });
        await Notification.insertMany([
            {
                recipient: clientUser._id,
                sender: ptUser._id,
                title: 'Lên lịch thành công',
                message: 'Buổi tập Upper body strength đã được lên lịch vào ngày mai.',
                type: 'Success',
                read: false
            },
            {
                recipient: clientUser._id,
                sender: ptUser._id,
                title: 'Đổi lịch tập',
                message: 'PT của bạn vừa đề xuất đổi lịch tập cho buổi tiếp theo.',
                type: 'Alert',
                read: false
            },
            {
                recipient: clientUser._id,
                title: 'Nhắc nhở uống nước',
                message: 'Đừng quên uống đủ 2.5 lít nước mỗi ngày để cơ thể luôn tràn đầy năng lượng!',
                type: 'Info',
                read: true
            }
        ]);

        console.log('--- SEED SUCCESS ---');
        console.log('Login credentials for testing:');
        console.log('Email:', clientUser.email);
        console.log('Password: 123456');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding data:', err);
        process.exit(1);
    }
};

seedDB();
