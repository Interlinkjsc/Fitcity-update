const { getPagination } = require('../../../utils/paginationHelper');
const PtAvailabilitySlot = require('../models/ptAvailabilitySlotModel.js');

exports.listRequests = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const filter = { status: 'Pending' };

        const totalDocs = await PtAvailabilitySlot.countDocuments(filter);
        const pagination = getPagination(totalDocs, page, limit);

        const pendingSlots = await PtAvailabilitySlot.find(filter)
            .populate('pt', 'name')
            .populate('branch', 'name')
            .populate('pending.client', 'name')
            .sort({ 'pending.requestedAt': -1 })
            .skip((pagination.page - 1) * limit)
            .limit(limit)
            .lean();

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

exports.approveRequest = async (req, res, next) => {
    try {
        const slot = await PtAvailabilitySlot.findById(req.params.id);

        if (!slot || slot.status !== 'Pending') {
            req.flash('error_msg', 'Yêu cầu không hợp lệ hoặc đã được xử lý.');
            return res.redirect('/admin/slots/requests');
        }

        slot.status = 'Booked';
        await slot.save();

        req.flash('success_msg', 'Đã duyệt yêu cầu đặt/đổi lịch.');
        res.redirect('/admin/slots/requests');
    } catch (err) {
        next(err);
    }
};

exports.rejectRequest = async (req, res, next) => {
    try {
        const slot = await PtAvailabilitySlot.findById(req.params.id);

        if (!slot || slot.status !== 'Pending') {
            req.flash('error_msg', 'Yêu cầu không hợp lệ hoặc đã được xử lý.');
            return res.redirect('/admin/slots/requests');
        }

        slot.status = 'Open';
        slot.pending = {
            client: null,
            type: 'Book',
            requestedAt: null,
            note: ''
        };
        await slot.save();

        req.flash('success_msg', 'Đã từ chối yêu cầu, slot trở lại trạng thái Open.');
        res.redirect('/admin/slots/requests');
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
