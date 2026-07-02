const Contract = require('../../contracts/models/contractModel.js');
const WorkoutSession = require('../../programs/models/workoutSessionModel.js');


/**
 * Client: xem slot PT mở sẵn theo tuần
 * GET /client/schedule?week=YYYY-MM-DD
 */
exports.getSchedule = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        const rescheduleSessionId = req.query.rescheduleSessionId || null;

        const contract = await Contract.findOne({ client: clientId, contractStatus: 'Active' })
            .populate('pt', 'name avatar')
            .populate('branch', 'name address')
            .sort({ createdAt: -1 })
            .lean();

        if (!contract || !contract.pt) {
            const nowMs = Date.now();
            const pastSessions = await WorkoutSession.find({
                client: clientId,
                $or: [
                    { status: { $in: ['Completed', 'Cancelled', 'No_Show'] } },
                    { status: 'Scheduled', scheduledTime: { $lt: new Date(nowMs - 24 * 60 * 60 * 1000) } }
                ]
            })
                .populate('pt', 'name avatar')
                .sort({ scheduledTime: -1 })
                .limit(50)
                .lean();

            return res.render('client/schedule', {
                contract: null,
                pt: null,
                schedule: {},
                weekDays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
                monday: new Date(),
                sunday: new Date(),
                myRequests: [],
                upcomingSessions: [],
                pastSessions,
                rescheduleSessionId: null,
                activePage: 'schedule'
            });
        }

        let baseDate;
        if (req.query.week) {
            baseDate = new Date(req.query.week);
            if (isNaN(baseDate.getTime())) baseDate = new Date();
        } else {
            baseDate = new Date();
        }

        const dayOfWeek = baseDate.getDay() || 7;
        const monday = new Date(baseDate);
        monday.setDate(baseDate.getDate() - dayOfWeek + 1);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const slots = [];

        const myRequests = [];

        const upcomingSessions = await WorkoutSession.find({
            client: clientId,
            status: { $in: ['Scheduled', 'Pending_Admin', 'In_Progress'] },
            scheduledTime: { $gte: new Date() }
        })
            .populate('pt', 'name avatar')
            .sort({ scheduledTime: 1 })
            .limit(5)
            .lean();

        const nowMs = Date.now();
        const pastSessions = await WorkoutSession.find({
            client: clientId,
            $or: [
                { status: { $in: ['Completed', 'Confirmed', 'Cancelled', 'No_Show'] } },
                { status: 'Scheduled', scheduledTime: { $lt: new Date(nowMs - 24 * 60 * 60 * 1000) } }
            ]
        })
            .populate('pt', 'name avatar')
            .sort({ scheduledTime: -1 })
            .limit(50)
            .lean();

        const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        const schedule = {};
        weekDays.forEach((day, idx) => {
            const dayDate = new Date(monday);
            dayDate.setDate(monday.getDate() + idx);
            schedule[day] = {
                date: dayDate,
                slots: slots.filter(s => {
                    const d = new Date(s.startTime);
                    return d.getDate() === dayDate.getDate() && d.getMonth() === dayDate.getMonth();
                })
            };
        });

        res.render('client/schedule', {
            contract,
            pt: contract.pt,
            schedule,
            weekDays,
            monday,
            sunday,
            myRequests,
            upcomingSessions,
            pastSessions,
            rescheduleSessionId,
            activePage: 'schedule'
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Client: gửi yêu cầu đặt slot
 * POST /client/schedule/request
 */
exports.requestBooking = async (req, res, next) => {
    req.flash('error_msg', 'Tính năng đặt lịch qua slot đã bị đóng. Vui lòng liên hệ HLV của bạn để lên lịch trực tiếp.');
    return res.redirect('/client/schedule');
};

/**
 * Client: gửi yêu cầu đổi lịch sang slot mới
 * POST /client/sessions/:id/reschedule-request
 */
exports.requestReschedule = async (req, res, next) => {
    req.flash('error_msg', 'Tính năng đổi lịch qua slot đã bị đóng. Vui lòng liên hệ HLV của bạn để lên lịch trực tiếp.');
    return res.redirect('/client/schedule');
};

