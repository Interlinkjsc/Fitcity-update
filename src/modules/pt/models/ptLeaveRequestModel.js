const mongoose = require('mongoose');

const ptLeaveRequestSchema = new mongoose.Schema(
    {
        pt: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        branch: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true
        },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        reason: { type: String, required: true, trim: true },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending'
        },
        replacementPt: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        contractsReassigned: { type: Number, default: 0 },
        managerNote: String,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: Date
    },
    { timestamps: true }
);

ptLeaveRequestSchema.index({ pt: 1, startDate: -1 });

module.exports = mongoose.model('PTLeaveRequest', ptLeaveRequestSchema);
