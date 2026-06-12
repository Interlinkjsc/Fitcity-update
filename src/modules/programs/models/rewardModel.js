const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Khách hàng là bắt buộc']
    },
    coupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon'
    },
    type: {
        type: String,
        enum: ['Voucher', 'FreeSession', 'Discount', 'Gift'],
        required: [true, 'Loại thưởng là bắt buộc']
    },
    title: {
        type: String,
        required: [true, 'Tiêu đề là bắt buộc'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    value: {
        type: Number,
        default: 0,
        min: [0, 'Giá trị không được âm']
    },
    status: {
        type: String,
        enum: ['Active', 'Used', 'Expired'],
        default: 'Active'
    },
    expiresAt: {
        type: Date,
        required: [true, 'Ngày hết hạn là bắt buộc']
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Người gán là bắt buộc']
    },
    usedAt: {
        type: Date
    },
    notes: {
        type: String,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Reward', rewardSchema);
