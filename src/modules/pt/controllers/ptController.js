const WorkoutSession = require('../../programs/models/workoutSessionModel.js');
const workoutService = require('../../programs/services/workoutService.js');
const notificationService = require('../../platform/services/notificationService');
const Contract = require('../../contracts/models/contractModel.js');

exports.checkOutSession = async (req, res, next) => {
    try {
        const sessionId = req.params.id;
        const session = await WorkoutSession.findById(sessionId);

        if (!session) {
            req.flash('error_msg', 'Không tìm thấy buổi tập!');
            return res.redirect('/pt');
        }

        if (session.status !== 'In_Progress') {
            req.flash('error_msg', 'Buổi tập không ở trạng thái đang diễn ra!');
            return res.redirect('/pt');
        }

        session.status = 'Completed';
        session.endTime = new Date();
        await session.save();

        req.flash('success_msg', 'Chúc mừng! Bạn đã hoàn thành buổi dạy.');
        res.redirect('/pt');
    } catch (err) {
        next(err);
    }
};

const MealPlan = require('../../programs/models/mealPlanModel.js');
const Payroll = require('../../finance/models/payrollModel.js');

exports.scanQrToken = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;
        const { token } = req.body;
        const { verifyQrToken } = require('../../../utils/qrToken');

        const payload = verifyQrToken(token);
        if (String(payload.pid) !== String(ptId)) {
            req.flash('error_msg', 'QR không thuộc PT của bạn.');
            return res.redirect('/pt');
        }

        const session = await workoutService.processQrScan(payload.sid, ptId);
        
        if (session.status === 'In_Progress') {
            req.flash('success_msg', 'Đã bắt đầu buổi tập (In Progress).');
        } else if (session.status === 'Completed') {
            req.flash('success_msg', 'Buổi tập đã hoàn thành. Chờ khách hàng xác nhận để chốt buổi.');
        } else {
            req.flash('success_msg', 'Cập nhật trạng thái thành công.');
        }

        return res.redirect('/pt');
    } catch (err) {
        req.flash('error_msg', err.message);
        return res.redirect('/pt');
    }
};

exports.acceptCancelRequest = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;
        const session = await WorkoutSession.findById(req.params.id);
        if (!session) {
            req.flash('error_msg', 'Không tìm thấy buổi tập!');
            return res.redirect('/pt/requests');
        }
        if (String(session.pt) !== String(ptId)) {
            req.flash('error_msg', 'Bạn không có quyền xử lý buổi tập này.');
            return res.redirect('/pt/requests');
        }
        if (session.status !== 'Cancel_Requested') {
            req.flash('error_msg', 'Buổi tập không ở trạng thái chờ hủy.');
            return res.redirect('/pt/requests');
        }

        session.status = 'Cancelled';
        await session.save();
        await notificationService.pushNotification(
            session.client,
            'Yêu cầu hủy lịch đã được duyệt',
            'PT đã đồng ý hủy lịch tập của bạn.',
            'Info',
            '/client/schedule',
            ptId
        );
        req.flash('success_msg', 'Đã chấp nhận yêu cầu hủy lịch tập.');
        return res.redirect('/pt/requests');
    } catch (err) {
        next(err);
    }
};

exports.rejectCancelRequest = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;
        const session = await WorkoutSession.findById(req.params.id);
        if (!session) {
            req.flash('error_msg', 'Không tìm thấy buổi tập!');
            return res.redirect('/pt/requests');
        }
        if (String(session.pt) !== String(ptId)) {
            req.flash('error_msg', 'Bạn không có quyền xử lý buổi tập này.');
            return res.redirect('/pt/requests');
        }
        if (session.status !== 'Cancel_Requested') {
            req.flash('error_msg', 'Buổi tập không ở trạng thái chờ hủy.');
            return res.redirect('/pt/requests');
        }

        session.status = 'Scheduled';
        await session.save();
        await notificationService.pushNotification(
            session.client,
            'Yêu cầu hủy lịch bị từ chối',
            'PT đã từ chối yêu cầu hủy. Buổi tập vẫn giữ lịch ban đầu.',
            'Warning',
            '/client/schedule',
            ptId
        );
        req.flash('success_msg', 'Đã từ chối yêu cầu hủy, lịch tập giữ nguyên.');
        return res.redirect('/pt/requests');
    } catch (err) {
        next(err);
    }
};

exports.getIncome = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;
        const now = new Date();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        const year = parseInt(req.query.year) || now.getFullYear();

        let records = await Payroll.find({ staff: ptId, month, year })
            .sort({ period: 1 })
            .lean();

        if (records.length === 0) {
            const payrollService = require('../../finance/services/payrollService.js');
            const User = require('../../users/models/userModel.js');
            const staff = await User.findById(ptId);
            if (staff) {
                const startOfMonth = new Date(year, month - 1, 1);
                const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
                const { commission } = await payrollService.resolvePTPayrollCommission(
                    ptId,
                    startOfMonth,
                    endOfMonth
                );
                records = await payrollService.generateBiMonthlyPayroll(staff, commission, month, year);
            }
        }

        const total = records.reduce((sum, r) => sum + (r.totalSalary || 0), 0);
        const paid = records.filter(r => r.status === 'Paid').reduce((sum, r) => sum + (r.totalSalary || 0), 0);
        const pending = total - paid;

        res.render('pt/income', {
            month,
            year,
            records,
            total,
            paid,
            pending,
            activePage: 'metrics'
        });
    } catch (err) {
        next(err);
    }
};

exports.getMealPlanEdit = async (req, res, next) => {
    try {
        const mealPlan = await MealPlan.findById(req.params.id)
            .populate('client', 'name avatar')
            .populate('pt', 'name');

        if (!mealPlan) {
            req.flash('error_msg', 'Không tìm thấy chế độ dinh dưỡng.');
            return res.redirect('/pt/clients');
        }

        if (mealPlan.pt._id.toString() !== req.session.user.id) {
            req.flash('error_msg', 'Bạn không có quyền chỉnh sửa meal plan này.');
            return res.redirect('/pt/clients');
        }

        res.render('pt/meal-plan-edit', { 
            mealPlan,
            activePage: 'pt-clients' 
        });
    } catch (err) {
        next(err);
    }
};

exports.updateMealPlan = async (req, res, next) => {
    try {
        const { goal, dailyCalories, protein, carbs, fat, fiber } = req.body;

        const mealPlan = await MealPlan.findById(req.params.id);
        if (!mealPlan) {
            req.flash('error_msg', 'Không tìm thấy chế độ dinh dưỡng.');
            return res.redirect('/pt/clients');
        }

        if (mealPlan.pt.toString() !== req.session.user.id) {
            req.flash('error_msg', 'Bạn không có quyền chỉnh sửa.');
            return res.redirect('/pt/clients');
        }

        mealPlan.goal = goal;
        mealPlan.dailyCalories = Number(dailyCalories) || 2000;
        mealPlan.macros = {
            protein: Number(protein) || 30,
            carbs: Number(carbs) || 35,
            fat: Number(fat) || 25,
            fiber: Number(fiber) || 10
        };
        await mealPlan.save();

        req.flash('success_msg', 'Đã cập nhật chế độ dinh dưỡng thành công!');
        res.redirect('/pt/clients');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/pt/clients');
    }
};

exports.getPendingRequests = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;
        const cancelRequestedSessions = await WorkoutSession.find({
            pt: ptId,
            status: 'Cancel_Requested'
        })
            .populate('client', 'name avatar')
            .sort({ scheduledTime: 1 })
            .lean();

        res.render('pt/requests', {
            pendingSlots: [],
            cancelRequestedSessions,
            activePage: 'pt-requests'
        });
    } catch (err) {
        next(err);
    }
};

exports.createDirectSession = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;
        const { contractId, clientId, scheduledTime, durationMinutes, notes } = req.body;

        // 1. Xác thực hợp đồng active và được gán cho PT này
        const contract = await Contract.findOne({
            _id: contractId,
            client: clientId,
            pt: ptId,
            contractStatus: 'Active'
        });

        if (!contract) {
            return res.status(400).json({ success: false, message: 'Hợp đồng không hợp lệ hoặc đã hết hạn.' });
        }

        if (contract.remainingSessions <= 0) {
            return res.status(400).json({ success: false, message: 'Hợp đồng này đã hết số buổi tập khả dụng.' });
        }

        // 2. Tạo trực tiếp WorkoutSession ở trạng thái Scheduled
        const session = await WorkoutSession.create({
            client: clientId,
            pt: ptId,
            contract: contractId,
            branch: contract.branch || req.session.user.branch,
            scheduledTime: new Date(scheduledTime),
            status: 'Pending_Admin',
            notes: notes || ''
        });

        // 3. Gửi Push Notification thông báo cho Client
        await notificationService.pushNotification(
            clientId,
            'Lịch tập mới được thiết lập',
            `HLV ${req.session.user.name} đã lên lịch tập mới cho bạn vào lúc ${new Date(scheduledTime).toLocaleString('vi-VN')}.`,
            'Info',
            '/client/schedule',
            ptId
        );

        // 4. Gửi Push Notification thông báo cho Admin/Manager chờ duyệt
        const User = require('../../users/models/userModel.js');
        const admins = await User.find({ role: { $in: ['Admin', 'Manager'] } }).select('_id').lean();
        for (const admin of admins) {
            await notificationService.pushNotification(
                admin._id,
                'Lịch tập mới chờ duyệt',
                `PT ${req.session.user.name} vừa tạo lịch tập cho khách hàng. Vui lòng xem xét và phê duyệt.`,
                'Warning',
                '/admin/sessions/pending',
                ptId
            );
        }

        return res.status(200).json({ success: true, message: 'Đã lên lịch tập trực tiếp thành công!', session });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};


