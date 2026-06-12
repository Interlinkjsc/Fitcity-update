const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Vui lòng chọn nhân viên vi phạm']
    },
    type: {
        type: String,
        required: [true, 'Vui lòng chọn loại vi phạm'],
        enum: {
            values: ['Đi trễ', 'Vắng mặt không phép', 'Thái độ không tốt', 'Vi phạm nội quy', 'Khác'],
            message: '{VALUE} không hợp lệ'
        }
    },
    description: {
        type: String,
        required: [true, 'Vui lòng cung cấp chi tiết vi phạm']
    },
    penaltyAmount: {
        type: Number,
        required: [true, 'Vui lòng nhập số tiền phạt'],
        min: [0, 'Số tiền phạt không được âm']
    },
    date: {
        type: Date,
        default: Date.now
    },
    loggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Applied_To_Payroll', 'Cancelled'],
        default: 'Pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Violation', violationSchema);
