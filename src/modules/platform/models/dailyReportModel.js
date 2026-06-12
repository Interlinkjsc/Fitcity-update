const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema(
    {
        author: {
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
        reportDate: {
            type: Date,
            required: true
        },
        summary: {
            type: String,
            required: [true, 'Tóm tắt công việc là bắt buộc'],
            trim: true
        },
        accomplishments: { type: String, trim: true },
        blockers: { type: String, trim: true },
        status: {
            type: String,
            enum: ['Pending_Approval', 'Approved', 'Rejected'],
            default: 'Pending_Approval'
        },
        managerNote: String,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: Date
    },
    { timestamps: true }
);

dailyReportSchema.index({ author: 1, reportDate: 1 }, { unique: true });
dailyReportSchema.index({ branch: 1, reportDate: -1 });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
