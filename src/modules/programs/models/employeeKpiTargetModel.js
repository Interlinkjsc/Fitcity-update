const mongoose = require('mongoose');

const employeeKpiTargetSchema = new mongoose.Schema({
    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    revenueTarget: { type: Number, default: 0 },
    contractTarget: { type: Number, default: 0 },
    newLeadTarget: { type: Number, default: 0 },
    sessionTarget: { type: Number, default: 0 },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

employeeKpiTargetSchema.index({ staff: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('EmployeeKPITarget', employeeKpiTargetSchema);
