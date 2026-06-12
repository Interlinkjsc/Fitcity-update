const { getPagination } = require('../../../utils/paginationHelper');

exports.listRequests = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const totalDocs = 0;
        const pendingSlots = [];

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
