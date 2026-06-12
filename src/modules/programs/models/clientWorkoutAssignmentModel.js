const mongoose = require('mongoose');

const weekDaySchema = new mongoose.Schema(
    {
        dayOfWeek: { type: Number, min: 1, max: 7, required: true },
        sessionTitle: String,
        exercises: [
            {
                name: String,
                sets: String,
                reps: String,
                rest: String,
                notes: String
            }
        ]
    },
    { _id: false }
);

const clientWorkoutAssignmentSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        pt: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        program: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'WorkoutProgram',
            required: true
        },
        startDate: { type: Date, default: Date.now },
        weekSchedule: [weekDaySchema],
        active: { type: Boolean, default: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('ClientWorkoutAssignment', clientWorkoutAssignmentSchema);
