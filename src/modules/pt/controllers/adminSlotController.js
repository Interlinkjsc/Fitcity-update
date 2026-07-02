const { getPagination } = require('../../../utils/paginationHelper');
const WorkoutSession = require('../../programs/models/workoutSessionModel.js');

// Bug 1.3: Lịch dạy PT — đổi sang WorkoutSession (có đủ client, scheduledTime)
// PtAvailabilitySlot.pending.client = null khi PT tự tạo session trực tiếp
exports.listRequests = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const filter = {
            scheduledTime: { $gte: startOfMonth }
        };
        if (req.query.status) {
            filter.status = req.query.status;
        } else {
            // Mặc định: hiện tất cả sessions tháng này (không chỉ Pending_Admin)
            filter.status = { $nin: ['Cancelled'] };
        }

        const totalDocs = await WorkoutSession.countDocuments(filter);
        const pendingSlots = await WorkoutSession.find(filter)
            .populate('pt', 'name avatar')
            .populate('client', 'name')
            .populate('branch', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        // Map sang cấu trúc mà template expects
        const mappedSlots = pendingSlots.map(s => ({
            _id: s._id,
            pt: s.pt,
            branch: s.branch,
            startTime: s.scheduledTime,
            status: s.status,
            pending: {
                client: s.client,
                requestedAt: s.createdAt,
                type: s.status === 'Pending_Admin' ? 'Book' : s.status
            }
        }));

        const pagination = getPagination(totalDocs, page, limit);

        res.render('admin/slots/requests', {
            pendingSlots: mappedSlots,
            pagination,
            activePage: 'slots',
            query: req.query
        });
    } catch (err) {
        next(err);
    }
};

exports.showCalendar = async (req, res, next) => { return res.redirect('/admin/slots/requests'); };
