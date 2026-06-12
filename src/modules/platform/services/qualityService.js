const mongoose = require('mongoose');
const WorkoutSession = require('../../programs/models/workoutSessionModel.js');

/**
 * CSAT từ feedback trên buổi tập Completed.
 * @param {{ startDate?: Date, endDate?: Date, branchId?: string, ptId?: string }} opts
 */
async function getCsatSummary(opts = {}) {
    const match = { status: 'Completed' };

    if (opts.startDate || opts.endDate) {
        match.endTime = {};
        if (opts.startDate) match.endTime.$gte = opts.startDate;
        if (opts.endDate) match.endTime.$lte = opts.endDate;
    }
    if (opts.branchId && opts.branchId !== 'all') {
        match.branch = new mongoose.Types.ObjectId(opts.branchId);
    }
    if (opts.ptId) {
        match.pt = new mongoose.Types.ObjectId(opts.ptId);
    }

    const [totals, rated] = await Promise.all([
        WorkoutSession.countDocuments(match),
        WorkoutSession.countDocuments({
            ...match,
            'feedback.rating': { $exists: true, $ne: null }
        })
    ]);

    const avgResult = await WorkoutSession.aggregate([
        { $match: { ...match, 'feedback.rating': { $gte: 1 } } },
        { $group: { _id: null, avgRating: { $avg: '$feedback.rating' } } }
    ]);

    const byPt = await WorkoutSession.aggregate([
        { $match: { ...match, 'feedback.rating': { $gte: 1 } } },
        {
            $group: {
                _id: '$pt',
                avgRating: { $avg: '$feedback.rating' },
                count: { $sum: 1 }
            }
        },
        { $sort: { avgRating: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'ptInfo'
            }
        },
        { $unwind: { path: '$ptInfo', preserveNullAndEmptyArrays: true } }
    ]);

    const feedbackRate = totals > 0 ? Math.round((rated / totals) * 1000) / 10 : 0;
    const avgRating = avgResult[0] ? Math.round(avgResult[0].avgRating * 10) / 10 : 0;

    return {
        totalCompleted: totals,
        ratedSessions: rated,
        feedbackRatePercent: feedbackRate,
        avgRating,
        topPts: byPt.map((row) => ({
            ptId: row._id,
            ptName: row.ptInfo?.name || '—',
            avgRating: Math.round(row.avgRating * 10) / 10,
            count: row.count
        }))
    };
}

module.exports = {
    getCsatSummary
};
