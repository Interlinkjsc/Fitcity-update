const mongoose = require('mongoose');
const DailyReport = require('../models/dailyReportModel');
const User = require('../../users/models/userModel');

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function monthRange(month, year) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
}

function buildListFilter(user, query = {}) {
    const filter = {};
    const { status, branchId, month, year, authorId } = query;

    if (status && status !== 'all') filter.status = status;
    if (authorId && authorId !== 'all') filter.author = authorId;

    if (month && year) {
        const { start, end } = monthRange(Number(month), Number(year));
        filter.reportDate = { $gte: start, $lte: end };
    }

    if (user.role === 'Manager' && user.branch) {
        filter.branch = user.branch;
    } else if (branchId && branchId !== 'all') {
        filter.branch = new mongoose.Types.ObjectId(branchId);
    }

    return filter;
}

exports.submitReport = async (authorId, branchId, payload) => {
    const reportDate = startOfDay(payload.reportDate || new Date());
    const existing = await DailyReport.findOne({ author: authorId, reportDate });
    if (existing && existing.status !== 'Rejected') {
        throw new Error('Bạn đã nộp báo cáo cho ngày này.');
    }
    if (existing && existing.status === 'Rejected') {
        existing.summary = payload.summary;
        existing.accomplishments = payload.accomplishments;
        existing.blockers = payload.blockers;
        existing.status = 'Pending_Approval';
        existing.managerNote = undefined;
        await existing.save();
        return existing;
    }
    return DailyReport.create({
        author: authorId,
        branch: branchId,
        reportDate,
        summary: payload.summary,
        accomplishments: payload.accomplishments,
        blockers: payload.blockers
    });
};

exports.approve = async (id, managerId, note) => {
    const doc = await DailyReport.findById(id);
    if (!doc) throw new Error('Không tìm thấy báo cáo');
    doc.status = 'Approved';
    doc.reviewedBy = managerId;
    doc.reviewedAt = new Date();
    if (note) doc.managerNote = note;
    await doc.save();
    return doc;
};

exports.reject = async (id, managerId, note) => {
    const doc = await DailyReport.findById(id);
    if (!doc) throw new Error('Không tìm thấy báo cáo');
    doc.status = 'Rejected';
    doc.reviewedBy = managerId;
    doc.reviewedAt = new Date();
    if (note) doc.managerNote = note;
    await doc.save();
    return doc;
};

/**
 * % hoàn thành daily report trong tháng (ước lượng: báo cáo đã nộp / nhân sự × ngày đã qua).
 */
exports.getCompletionStats = async ({ branchId, month, year, managerBranchId } = {}) => {
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();
    const { start, end } = monthRange(m, y);

    const staffFilter = {
        role: { $in: ['PT', 'Sales'] },
        status: 'Active'
    };
    if (managerBranchId) staffFilter.branch = managerBranchId;
    else if (branchId && branchId !== 'all') staffFilter.branch = branchId;

    const staffCount = await User.countDocuments(staffFilter);
    const today = new Date();
    const periodEnd = end > today ? today : end;
    const daysElapsed = Math.max(
        1,
        Math.ceil((periodEnd - start) / (1000 * 60 * 60 * 24)) + 1
    );
    const expectedSlots = staffCount * daysElapsed;

    const reportFilter = {
        reportDate: { $gte: start, $lte: end },
        status: { $in: ['Pending_Approval', 'Approved'] }
    };
    if (managerBranchId) reportFilter.branch = managerBranchId;
    else if (branchId && branchId !== 'all') {
        reportFilter.branch = new mongoose.Types.ObjectId(branchId);
    }

    const submitted = await DailyReport.countDocuments(reportFilter);

    const completionRate =
        expectedSlots > 0 ? Math.min(100, Math.round((submitted / expectedSlots) * 1000) / 10) : 0;

    return {
        staffCount,
        daysElapsed,
        submitted,
        expectedSlots,
        completionRatePercent: completionRate
    };
};

exports.listReports = (filter, options = {}) => {
    const q = DailyReport.find(filter)
        .populate('author', 'name role avatar')
        .populate('branch', 'name')
        .populate('reviewedBy', 'name')
        .sort({ reportDate: -1, createdAt: -1 });
    if (options.skip != null) q.skip(options.skip);
    if (options.limit) q.limit(options.limit);
    return q;
};

exports.buildListFilter = buildListFilter;
exports.monthRange = monthRange;
