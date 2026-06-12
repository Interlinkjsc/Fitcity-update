const mongoose = require('mongoose');

const workoutSessionSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Khách hàng là bắt buộc']
    },
    pt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Huấn luyện viên là bắt buộc']
    },
    contract: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract',
        required: [true, 'Hợp đồng đi kèm là bắt buộc']
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [true, 'Chi nhánh tập luyện là bắt buộc']
    },
    scheduledTime: {
        type: Date,
        required: [true, 'Thời gian dự kiến tập là bắt buộc']
    },
    startTime: Date,
    endTime: Date,
    status: {
        type: String,
        enum: ['Pending_Admin', 'Scheduled', 'Cancel_Requested', 'In_Progress', 'Completed', 'Confirmed', 'Cancelled', 'No_Show'],
        default: 'Pending_Admin'
    },
    clientConfirmation: {
        time: Date,
        isConfirmed: {
            type: Boolean,
            default: false
        }
    },
    qrCode: {
        token: {
            type: String,
            index: true
        },
        expiresAt: Date,
        scannedAt: Date
    },
    notes: String,
    workoutPlan: String, // Short description of what to do today
    feedback: {
        rating: { type: Number, min: 1, max: 5 },
        comment: String
    }
}, { timestamps: true });

module.exports = mongoose.model('WorkoutSession', workoutSessionSchema);
