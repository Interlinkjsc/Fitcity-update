
const mongoose = require('mongoose');
const User = require('../modules/users/models/userModel.js');
const Contract = require('../modules/contracts/models/contractModel.js');
const MealPlan = require('../modules/programs/models/mealPlanModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity';

async function seedMealPlan() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to DB for MealPlan seeding');

        // Find PT and Client
        const pt = await User.findOne({ role: 'PT' });
        const client = await User.findOne({ role: 'Client' });
        const contract = await Contract.findOne({ client: client._id, contractStatus: 'Active' });

        if (!pt || !client || !contract) {
            console.error('❌ Could not find PT, Client or Active Contract. Please run fmsSeeder.js first.');
            process.exit(1);
        }

        // Clear existing meal plans for this client
        await MealPlan.deleteMany({ client: client._id });

        const mealPlan = await MealPlan.create({
            client: client._id,
            pt: pt._id,
            contract: contract._id,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            goal: 'Muscle Gain',
            dailyCalories: 2800,
            macros: {
                protein: 35,
                carbs: 45,
                fat: 20
            },
            meals: [
                {
                    time: '07:30',
                    foodItems: [
                        { name: 'Yến mạch nấu sữa', quantity: '100g', calories: 350 },
                        { name: 'Trứng ốp la', quantity: '2 quả', calories: 150 },
                        { name: 'Chuối chín', quantity: '1 quả', calories: 100 }
                    ],
                    notes: 'Ăn ngay sau khi ngủ dậy 30 phút.'
                },
                {
                    time: '12:30',
                    foodItems: [
                        { name: 'Ức gà áp chảo', quantity: '200g', calories: 400 },
                        { name: 'Cơm gạo lứt', quantity: '150g', calories: 250 },
                        { name: 'Súp lơ xanh', quantity: '100g', calories: 50 }
                    ],
                    notes: 'Bữa trưa giàu đạm để phục hồi cơ bắp.'
                },
                {
                    time: '16:00',
                    foodItems: [
                        { name: 'Whey Protein', quantity: '1 serving', calories: 120 },
                        { name: 'Hạt hạnh nhân', quantity: '30g', calories: 180 }
                    ],
                    notes: 'Bữa phụ trước khi tập.'
                },
                {
                    time: '19:30',
                    foodItems: [
                        { name: 'Cá hồi nướng', quantity: '200g', calories: 450 },
                        { name: 'Khoai lang tím', quantity: '100g', calories: 110 },
                        { name: 'Salad rau củ', quantity: '1 đĩa', calories: 80 }
                    ],
                    notes: 'Hạn chế dầu mỡ vào buổi tối.'
                }
            ],
            active: true
        });

        console.log('✅ SEEDED PREMIUM MEAL PLAN FOR:', client.name);
        process.exit(0);
    } catch (error) {
        console.error('❌ SEEDING ERROR:', error);
        process.exit(1);
    }
}

seedMealPlan();
