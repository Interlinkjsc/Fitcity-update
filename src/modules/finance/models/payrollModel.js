const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Nhân viên là bắt buộc']
    },
    month: {
        type: Number,
        required: [true, 'Tháng tính lương là bắt buộc'],
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: [true, 'Năm tính lương là bắt buộc'],
        min: 2000
    },
    period: {
        type: Number,
        enum: [1, 2],
        default: 1,
        required: true
    },
    baseSalary: {
        type: Number,
        default: 0
    },
    commission: {
        type: Number,
        default: 0,
        min: [0, 'Hoa hồng không được âm']
    },
    // Rp27/7 A2 (QC review 1): snapshot tách hoa hồng tại thời điểm chốt kỳ lương —
    // hiển thị lịch sử không bị trôi khi dữ liệu buổi dạy/HĐ thay đổi sau khi chốt.
    teachingCommission: {
        type: Number,
        default: null
    },
    salesCommission: {
        type: Number,
        default: null
    },
    bonus: {
        type: Number,
        default: 0
    },
    deductions: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    insurance: {
        type: Number,
        default: 0
    },
    totalSalary: {
        type: Number,
        required: [true, 'Tổng lương thực nhận là bắt buộc']
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid'],
        default: 'Pending'
    },
    suggestedPayDate: {
        type: Date
    },
    paymentDate: Date,
    note: String
}, { timestamps: true });

// Ensure one payroll per staff per month per period
payrollSchema.index({ staff: 1, month: 1, year: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
