const mongoose = require('mongoose');

const timesheetSchema = new mongoose.Schema({
    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true
    },
    checkIn: {
        type: Date,
        required: true
    },
    checkOut: Date,
    status: {
        type: String,
        enum: ['Open', 'Pending_Approval', 'Approved', 'Rejected'],
        default: 'Open'
    },
    notes: String,
    managerNote: String,
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date
}, { timestamps: true });

timesheetSchema.index({ staff: 1, checkIn: -1 });

module.exports = mongoose.model('Timesheet', timesheetSchema);
