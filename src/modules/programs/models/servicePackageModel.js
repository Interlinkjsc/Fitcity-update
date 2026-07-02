const mongoose = require('mongoose');
const servicePackageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên gói tập là bắt buộc'],
        trim: true,
        unique: true
    },
    type: {
        type: String,
        required: [true, 'Loại gói tập là bắt buộc'],
        enum: {
            values: ['Gym', 'Gym Kids', 'Pilates'],
            message: '{VALUE} không phải là loại gói tập hợp lệ'
        }
    },
    durationMonths: {
        type: Number,
        min: [1, 'Thời hạn tối thiểu là 1 tháng']
    },
    /** Legacy: số ngày (= durationMonths × 30), đồng bộ khi lưu */
    duration: {
        type: Number,
        min: [1, 'Thời hạn tối thiểu là 1 ngày']
    },
    sessions: {
        type: Number,
        default: 0,
        min: [0, 'Số buổi tập không được âm']
    },
    isUnlimited: {
        type: Boolean,
        default: false
    },
    target: {
        type: String,
        trim: true,
        default: 'Giảm cân',
        enum: {
            values: ['Giảm cân', 'Tăng cơ', 'Gym', 'Gym Kids', 'Pilates', 'Yoga', 'CrossFit', 'Boxing'],
            message: '{VALUE} không phải là mục tiêu tập luyện hợp lệ'
        }
    },
    sessionType: {
        type: String,
        enum: {
            values: ['1-1', '1-2'],
            message: '{VALUE} không phải là hình thức tập hợp lệ'
        },
        default: '1-1'
    },
    price: {
        type: Number,
        required: [true, 'Giá / buổi là bắt buộc'],
        min: [0, 'Giá / buổi không được âm']
    },
    description: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, { timestamps: true });

const { monthsToDays, daysToMonths } = require('../../../utils/contractDurationHelper');

servicePackageSchema.pre('validate', function syncDurationFields() {
    if (this.durationMonths != null) {
        this.duration = monthsToDays(this.durationMonths);
    } else if (this.duration != null) {
        this.durationMonths = daysToMonths(this.duration);
    }
});

servicePackageSchema.pre('save', function syncDurationOnSave() {
    if (this.durationMonths != null) {
        this.duration = monthsToDays(this.durationMonths);
    } else if (this.duration != null && !this.durationMonths) {
        this.durationMonths = daysToMonths(this.duration);
    }
});

module.exports = mongoose.model('ServicePackage', servicePackageSchema);
