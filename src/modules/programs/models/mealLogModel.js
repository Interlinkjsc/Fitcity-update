const mongoose = require('mongoose');

const mealLogSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        logDate: {
            type: Date,
            required: true,
            index: true
        },
        mealType: {
            type: String,
            enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
            required: true
        },
        description: { type: String, trim: true },
        calories: { type: Number, min: 0 },
        compliance: {
            type: String,
            enum: ['Followed', 'Partial', 'Skipped'],
            default: 'Followed'
        }
    },
    { timestamps: true }
);

mealLogSchema.index({ client: 1, logDate: 1, mealType: 1 });

module.exports = mongoose.model('MealLog', mealLogSchema);
