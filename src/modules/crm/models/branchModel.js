const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên chi nhánh là bắt buộc'],
        unique: true,
        trim: true
    },
    address: {
        type: String,
        required: [true, 'Địa chỉ chi nhánh là bắt buộc'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Số điện thoại chi nhánh là bắt buộc'],
        trim: true,
        validate: {
            validator: function(v) {
                return /^(0|\+84)(\d{9,10})$/.test(v);
            },
            message: props => `${props.value} không phải là số điện thoại hợp lệ!`
        }
    },
    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: {
            values: ['Open', 'Closed', 'Maintenance'],
            message: '{VALUE} không phải là trạng thái hợp lệ'
        },
        default: 'Open'
    },
    location: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 }
    },
    operatingHours: {
        open: { type: String, default: '06:00' },
        close: { type: String, default: '22:00' }
    }
}, { timestamps: true });

module.exports = mongoose.model('Branch', branchSchema);
