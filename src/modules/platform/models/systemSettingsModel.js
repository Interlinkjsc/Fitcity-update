const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    key: {
        type: String,
        unique: true,
        default: 'global'
    },
    defaultVat: {
        type: Number,
        default: 10,
        min: 0,
        max: 100
    },
    defaultPtCommissionRate: {
        type: Number,
        default: 10,
        min: 0,
        max: 100
    },
    /** contract | timesheet | hybrid — cách tính hoa hồng PT trên payroll */
    ptPayrollMode: {
        type: String,
        enum: ['contract', 'timesheet', 'hybrid'],
        default: 'contract'
    },
    /** VNĐ / ca dạy đã duyệt (timesheet & hybrid) */
    timesheetRatePerShift: {
        type: Number,
        default: 120000,
        min: 0
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
