const mongoose = require('mongoose');

const kpiConfigSchema = new mongoose.Schema({
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [true, 'Chi nhánh là bắt buộc']
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true,
        default: new Date().getFullYear()
    },
    revenueTarget: {
        type: Number,
        required: [true, 'KPI doanh thu là bắt buộc'],
        default: 0
    },
    newLeadTarget: {
        type: Number,
        default: 0
    },
    contractTarget: {
        type: Number,
        default: 0
    },
    notes: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Ensure unique target per branch/month/year
kpiConfigSchema.index({ branch: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('KPIConfig', kpiConfigSchema);
