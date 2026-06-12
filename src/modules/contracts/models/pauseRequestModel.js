const mongoose = require('mongoose');

const pauseRequestSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contract: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract',
        required: true
    },
    startDate: {
        type: Date,
        required: [true, 'Ngày bắt đầu bảo lưu là bắt buộc']
    },
    durationDays: {
        type: Number,
        required: [true, 'Số ngày bảo lưu là bắt buộc'],
        min: [7, 'Bảo lưu tối thiểu 7 ngày']
    },
    reason: {
        type: String,
        required: [true, 'Lý do bảo lưu là bắt buộc']
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    adminNote: String
}, { timestamps: true });

module.exports = mongoose.model('PauseRequest', pauseRequestSchema);
