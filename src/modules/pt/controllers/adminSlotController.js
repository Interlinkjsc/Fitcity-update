const { getPagination } = require('../../../utils/paginationHelper');
const PtAvailabilitySlot = require('../models/ptAvailabilitySlotModel.js');

exports.listRequests = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;

        const filter = {};
        if (req.query.status) filter.status = req.query.status;

        const totalDocs = await PtAvailabilitySlot.countDocuments(filter);
        const pendingSlots = await PtAvailabilitySlot.find(filter)
            .populate('pt', 'name avatar')
            .populate('pending.client', 'name')
            .populate('branch', 'name')
            .sort({ startTime: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const pagination = getPagination(totalDocs, page, limit);

        res.render('admin/slots/requests', {
            pendingSlots,
            pagination,
            activePage: 'slots',
            query: req.query
        });
    } catch (err) {
        next(err);
    }
};

exports.showCalendar = async (req, res, next) => {
    try {
        const Branch = require('../../crm/models/branchModel.js');
        const branches = await Branch.find().select('name').lean();

        res.render('admin/slots/calendar', {
            branches,
            activePage: 'slots',
            title: 'Lịch tập tổng hợp'
        });
    } catch (err) {
        next(err);
    }
};
