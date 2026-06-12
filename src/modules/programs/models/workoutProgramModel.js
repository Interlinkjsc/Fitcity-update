const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    sets: String,
    reps: String,
    rest: String,
    notes: String
}, { _id: false });

const workoutProgramSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Tên giáo trình là bắt buộc']
    },
    goal: {
        type: String,
        enum: ['Giảm cân', 'Tăng cơ', 'Sức bền', 'Dẻo dai', 'Tổng hợp'],
        required: [true, 'Mục tiêu là bắt buộc']
    },
    level: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced'],
        default: 'Beginner'
    },
    description: String,
    duration: String, // e.g. "4 tuần", "8 tuần"
    sessionsPerWeek: { type: Number, default: 3 },
    exercises: [exerciseSchema],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isPublic: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('WorkoutProgram', workoutProgramSchema);
