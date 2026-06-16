const mongoose = require('mongoose');

const mealPlanSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Khách hàng là bắt buộc']
    },
    pt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'PT hướng dẫn là bắt buộc']
    },
    contract: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract',
        required: [true, 'Phải gắn với một hợp đồng đang hoạt động']
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    goal: {
        type: String,
        enum: ['Weight Loss', 'Weight Gain', 'Muscle Gain', 'Maintenance', 'Endurance', 'Other'],
        default: 'Maintenance'
    },
    dailyCalories: {
        type: Number,
        default: 2000
    },
    macros: {
        protein: { type: Number, default: 30 }, // % Đạm
        carbs: { type: Number, default: 35 },   // % Tinh bột
        fat: { type: Number, default: 25 },     // % Béo
        fiber: { type: Number, default: 10 }    // % Chất xơ
    },
    meals: [{
        time: String, // e.g. "08:00 AM", "Breakfast"
        foodItems: [{
            name: String,
            quantity: String,
            calories: Number
        }],
        notes: String
    }],
    status: {
        type: String,
        enum: ['pending_admin', 'approved', 'rejected'],
        default: 'pending_admin'
    },
    rejectionReason: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('MealPlan', mealPlanSchema);
