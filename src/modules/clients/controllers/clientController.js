const WorkoutSession = require('../../programs/models/workoutSessionModel.js');
const WorkoutProgram = require('../../programs/models/workoutProgramModel.js');
const PauseRequest = require('../../contracts/models/pauseRequestModel.js');
const Contract = require('../../contracts/models/contractModel.js');
const User = require('../../users/models/userModel.js');
const PaymentTransaction = require('../../contracts/models/transactionModel.js');
const Notification = require('../../platform/models/notificationModel.js');
const PTChangeRequest = require('../../pt/models/ptChangeRequestModel.js');
const notificationService = require('../../platform/services/notificationService');

/**
 * POST /client/sessions/:id/feedback — Đánh giá PT sau buổi tập
 */
exports.submitSessionFeedback = async (req, res, next) => {
    try {
        const sessionId = req.params.id;
        const { rating, comment } = req.body;
        const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

        const r = Number(rating);
        if (!Number.isFinite(r) || r < 1 || r > 5) {
            const msg = 'Vui lòng chọn điểm đánh giá từ 1 đến 5 sao.';
            if (isJson) return res.status(400).json({ success: false, message: msg });
            req.flash('error_msg', msg);
            return res.redirect('/client');
        }

        const session = await WorkoutSession.findById(sessionId);
        if (!session) {
            if (isJson) return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tập!' });
            req.flash('error_msg', 'Không tìm thấy buổi tập!');
            return res.redirect('/client');
        }

        if (session.client.toString() !== req.session.user.id.toString()) {
            if (isJson) return res.status(403).json({ success: false, message: 'Không có quyền.' });
            req.flash('error_msg', 'Không có quyền.');
            return res.redirect('/client');
        }

        if (!['Completed', 'Confirmed'].includes(session.status)) {
            const msg = 'Chỉ đánh giá được sau khi buổi tập hoàn thành.';
            if (isJson) return res.status(400).json({ success: false, message: msg });
            req.flash('error_msg', msg);
            return res.redirect('/client');
        }

        if (session.feedback?.rating) {
            const msg = 'Bạn đã đánh giá buổi tập này.';
            if (isJson) return res.status(400).json({ success: false, message: msg });
            req.flash('error_msg', msg);
            return res.redirect('/client');
        }

        await WorkoutSession.findByIdAndUpdate(sessionId, {
            $set: {
                feedback: {
                    rating: Math.round(r),
                    comment: (comment || '').trim().slice(0, 500)
                }
            }
        });

        if (isJson) {
            return res.json({ success: true, message: 'Cảm ơn bạn đã đánh giá!' });
        }
        req.flash('success_msg', 'Cảm ơn bạn đã đánh giá huấn luyện viên!');
        res.redirect('/client');
    } catch (err) {
        next(err);
    }
};

exports.confirmSession = async (req, res, next) => {
    try {
        const sessionId = req.params.id;
        const session = await WorkoutSession.findById(sessionId);

        const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

        if (!session) {
            if (isJson) return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tập!' });
            req.flash('error_msg', 'Không tìm thấy buổi tập!');
            return res.redirect('/client');
        }

        // Verify client ownership
        if (session.client.toString() !== req.session.user.id.toString()) {
            if (isJson) return res.status(403).json({ success: false, message: 'Bạn không có quyền xác nhận cho buổi tập này!' });
            req.flash('error_msg', 'Bạn không có quyền xác nhận cho buổi tập này!');
            return res.redirect('/client');
        }

        if (session.status !== 'Completed') {
            const msg = 'Chỉ có thể xác nhận khi buổi tập đã Completed.';
            if (isJson) return res.status(400).json({ success: false, message: msg });
            req.flash('error_msg', msg);
            return res.redirect('/client');
        }
        if (session.clientConfirmation?.isConfirmed || session.status === 'Confirmed') {
            const msg = 'Buổi tập này đã được xác nhận trước đó.';
            if (isJson) return res.status(400).json({ success: false, message: msg });
            req.flash('error_msg', msg);
            return res.redirect('/client');
        }

        await WorkoutSession.findByIdAndUpdate(sessionId, {
            $set: {
                status: 'Confirmed',
                'clientConfirmation.time': new Date(),
                'clientConfirmation.isConfirmed': true
            }
        });

        const contract = await Contract.findById(session.contract);
        if (contract && contract.remainingSessions > 0) {
            contract.remainingSessions -= 1;
            await contract.save();
        }

        if (isJson) {
            return res.json({ success: true, message: 'Xác nhận thành công!' });
        }

        req.flash('success_msg', 'Xác nhận hoàn thành buổi tập thành công!');
        res.redirect('/client');
    } catch (err) {
        const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
        if (isJson) return res.status(500).json({ success: false, message: 'Lỗi server' });
        next(err);
    }
};

exports.requestCancelSession = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        const sessionId = req.params.id;
        const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
        const session = await WorkoutSession.findById(sessionId);

        if (!session) {
            const msg = 'Không tìm thấy buổi tập.';
            if (isJson) return res.status(404).json({ success: false, message: msg });
            req.flash('error_msg', msg);
            return res.redirect('/client/schedule');
        }
        if (String(session.client) !== String(clientId)) {
            const msg = 'Bạn không có quyền hủy buổi tập này.';
            if (isJson) return res.status(403).json({ success: false, message: msg });
            req.flash('error_msg', msg);
            return res.redirect('/client/schedule');
        }
        if (session.status !== 'Scheduled') {
            const msg = 'Chỉ có thể yêu cầu hủy khi buổi tập đang Scheduled.';
            if (isJson) return res.status(400).json({ success: false, message: msg });
            req.flash('error_msg', msg);
            return res.redirect('/client/schedule');
        }

        session.status = 'Cancel_Requested';
        await session.save();
        await notificationService.pushNotification(
            session.pt,
            'Khách hàng yêu cầu hủy lịch tập',
            `Khách hàng ${req.session.user.name} vừa gửi yêu cầu hủy buổi tập.`,
            'Warning',
            '/pt/requests',
            clientId
        );

        if (isJson) return res.json({ success: true, message: 'Đã gửi yêu cầu hủy lịch tập.' });
        req.flash('success_msg', 'Đã gửi yêu cầu hủy lịch tập. PT sẽ phản hồi sớm.');
        return res.redirect('/client/schedule');
    } catch (err) {
        const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
        if (isJson) return res.status(500).json({ success: false, message: 'Lỗi server' });
        return next(err);
    }
};

/**
 * [Client] Hiển thị QR (start/end) cho PT quét, không lưu DB
 * GET /client/sessions/:id/qr?action=start|end
 */
exports.getSessionQr = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        const sessionId = req.params.id;
        const action = req.query.action;

        const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

        if (!['start', 'end'].includes(action)) {
            if (isJson) return res.status(400).json({ success: false, message: 'Tham số QR không hợp lệ.' });
            req.flash('error_msg', 'Tham số QR không hợp lệ.');
            return res.redirect('/client/workouts');
        }

        const session = await WorkoutSession.findById(sessionId)
            .populate('pt', 'name avatar')
            .lean();

        if (!session) {
            if (isJson) return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tập.' });
            req.flash('error_msg', 'Không tìm thấy buổi tập.');
            return res.redirect('/client/workouts');
        }
        if (session.client.toString() !== clientId.toString()) {
            if (isJson) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem QR buổi tập này.' });
            req.flash('error_msg', 'Bạn không có quyền xem QR buổi tập này.');
            return res.redirect('/client/workouts');
        }

        // Basic state guard (final guard will be on PT scan endpoint)
        if (action === 'start' && session.status !== 'Scheduled') {
            const pendingMsg = 'Lịch tập này đang chờ Admin phê duyệt. Bạn sẽ nhận thông báo khi được duyệt.';
            const genericMsg = 'Chỉ có thể hiển thị QR bắt đầu cho buổi Scheduled.';
            const msg = session.status === 'Pending_Admin' ? pendingMsg : genericMsg;
            if (isJson) return res.status(400).json({ success: false, message: msg });
            req.flash('error_msg', msg);
            return res.redirect('/client/workouts');
        }
        if (action === 'end' && session.status !== 'In_Progress') {
            if (isJson) return res.status(400).json({ success: false, message: 'Chỉ có thể hiển thị QR kết thúc cho buổi In Progress.' });
            req.flash('error_msg', 'Chỉ có thể hiển thị QR kết thúc cho buổi In Progress.');
            return res.redirect('/client/workouts');
        }

        const { signQrToken } = require('../../../utils/qrToken');
        const token = signQrToken({
            sid: session._id,
            act: action,
            cid: session.client,
            pid: session.pt && session.pt._id ? session.pt._id : session.pt,
            ttlSeconds: 600
        });

        if (isJson) {
            return res.json({ success: true, token, session, action });
        }

        return res.render('client/session-qr', {
            session,
            action,
            token
        });
    } catch (err) {
        next(err);
    }
};

/**
 * [Client] Gửi yêu cầu bảo lưu Hợp đồng
 */
exports.requestPause = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        const { contractId, startDate, durationDays, reason } = req.body;

        // Check if contract belongs to client and is active
        const contract = await Contract.findOne({ _id: contractId, client: clientId, contractStatus: 'Active' });
        if (!contract) {
            req.flash('error_msg', 'Hợp đồng không khả dụng để bảo lưu.');
            return res.redirect('/client');
        }

        // Check for existing pending request
        const existing = await PauseRequest.findOne({ contract: contractId, status: 'Pending' });
        if (existing) {
            req.flash('error_msg', 'Bạn đã có một yêu cầu bảo lưu đang chờ xử lý.');
            return res.redirect('/client');
        }

        await PauseRequest.create({
            client: clientId,
            contract: contractId,
            startDate: new Date(startDate),
            durationDays: Number(durationDays),
            reason
        });

        // NOTIFY ADMINS / CEO
        const admins = await User.find({ role: { $in: ['SA', 'CEO', 'Manager'] }, status: 'Active' });
        for (let admin of admins) {
            await notificationService.pushNotification(
                admin._id,
                'Yêu cầu bảo lưu mới',
                `Khách hàng ${req.session.user.name} vừa gửi yêu cầu bảo lưu hợp đồng ${contract.contractCode}.`,
                'Warning',
                '/admin/contracts/requests',
                clientId
            );
        }

        req.flash('success_msg', 'Yêu cầu bảo lưu của bạn đã được gửi. Vui lòng chờ bộ phận quản lý phê duyệt.');
        res.redirect('/client');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/client');
    }
};

/**
 * [Client] Xem Thư viện bài tập / Lịch tập của mình
 */
exports.getWorkouts = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        
        // Lấy danh sách các buổi tập đã lên lịch và đã tập xong của client này
        const sessions = await WorkoutSession.find({ client: clientId })
            .populate('pt', 'name avatar')
            .sort({ scheduledTime: -1 });

        // Lấy thư viện giáo trình bài tập công khai
        const programs = await WorkoutProgram.find({ isPublic: true }).sort({ goal: 1, level: 1 });
        const workoutAssignmentService = require('../../programs/services/workoutAssignmentService');
        const weekAssignment = await workoutAssignmentService.getActiveAssignment(clientId);

        res.render('client/workouts', {
            sessions,
            programs,
            weekAssignment,
            activePage: 'workouts'
        });
    } catch (err) {
        next(err);
    }
};

/**
 * [Client] Xem danh sách ưu đãi / voucher của tôi
 * GET /client/rewards
 */
exports.logMeal = async (req, res, next) => {
    try {
        const mealLogService = require('../../programs/services/mealLogService');
        await mealLogService.logMeal({
            clientId: req.session.user.id,
            logDate: req.body.logDate,
            mealType: req.body.mealType,
            description: req.body.description,
            calories: req.body.calories,
            compliance: req.body.compliance
        });
        req.flash('success_msg', 'Đã ghi nhật ký bữa ăn.');
        res.redirect('/client/nutrition');
    } catch (err) {
        next(err);
    }
};

exports.getMyRewards = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        const rewardService = require('../../programs/services/rewardService.js');
        const rewards = await rewardService.getClientRewards(clientId);
        res.render('client/rewards', {
            rewards,
            activePage: 'dashboard'
        });
    } catch (err) {
        next(err);
    }
};

// ========== PHASE 3: Client Contract & Receipt Viewing ==========

/**
 * [Client] Danh sách Hợp đồng của tôi
 * GET /client/contracts
 */
exports.getMyContracts = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;

        const contracts = await Contract.find({ client: clientId })
            .populate('servicePackage', 'name price durationInMonths maxSessions type')
            .populate('branch', 'name')
            .populate('pt', 'name')
            .sort({ createdAt: -1 })
            .lean();

        const contractIds = contracts.map(c => c._id);
        let latestTransactionByContract = {};
        if (contractIds.length > 0) {
            const txns = await PaymentTransaction.find({ contractId: { $in: contractIds } })
                .select('_id contractId createdAt')
                .sort({ createdAt: -1 })
                .lean();
            latestTransactionByContract = txns.reduce((acc, txn) => {
                const key = String(txn.contractId);
                if (!acc[key]) acc[key] = String(txn._id);
                return acc;
            }, {});
        }

        res.render('client/contracts', {
            contracts,
            latestTransactionByContract,
            activePage: 'contracts'
        });
    } catch (err) {
        next(err);
    }
};

/**
 * [Client] Preview Hợp đồng (HTML cho in ấn)
 * GET /client/contracts/:id/preview
 */
exports.previewMyContract = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;

        // Bug 23/7 C2: client xem HĐ phải đủ thông tin như admin (thiếu cccd/giới tính/địa chỉ/liên hệ khẩn cấp).
        const contractDoc = await Contract.findOne({ _id: req.params.id, client: clientId })
            .populate('client', 'name email phone avatar cccdNumber cccdIssueDate cccdIssuePlace address dob gender emergencyContact')
            .populate('servicePackage', 'name price durationInMonths maxSessions type')
            .populate('pt', 'name phone')
            .populate('branch', 'name address')
            .populate('sales', 'name');

        if (!contractDoc) {
            req.flash('error_msg', 'Không tìm thấy hợp đồng hoặc bạn không có quyền xem!');
            return res.redirect('/client/contracts');
        }

        // toObject({ getters: true }) để decrypt phone/email bị mã hóa trong populated docs
        const contract = contractDoc.toObject({ getters: true });

        // Dùng chung template preview với admin
        res.render('admin/contracts/templates/contract-preview', {
            contract,
            layout: false
        });
    } catch (err) {
        next(err);
    }
};

/**
 * [Client] Preview Phiếu Thu (HTML cho in ấn)
 * GET /client/contracts/:id/receipt/:transactionId
 */
exports.previewMyReceipt = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        const paymentService = require('../../contracts/services/paymentService.js');

        // Verify contract ownership
        const contract = await Contract.findOne({ _id: req.params.id, client: clientId })
            .populate('client', 'name email phone')
            .populate('branch', 'name address')
            .populate('servicePackage', 'name')
            .lean();
        if (contract) require('../../../utils/decryptLean').decryptPeople(contract, ['client']);

        if (!contract) {
            req.flash('error_msg', 'Không tìm thấy hợp đồng hoặc bạn không có quyền xem!');
            return res.redirect('/client/contracts');
        }

        const transaction = await paymentService.getTransactionDetail(req.params.transactionId);

        // Verify transaction belongs to this client
        if (transaction.clientId._id.toString() !== clientId.toString()) {
            req.flash('error_msg', 'Bạn không có quyền xem phiếu thu này!');
            return res.redirect('/client/contracts');
        }

        // Dùng chung template preview với admin
        res.render('admin/contracts/templates/receipt-preview', {
            transaction: transaction.toObject(),
            contract,
            layout: false
        });
    } catch (err) {
        next(err);
    }
};

/**
 * [Client] API lấy danh sách thông báo
 */
exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const notifications = await Notification.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .limit(20);
        
        const unreadCount = await Notification.countDocuments({ recipient: userId, read: false });

        res.json({ success: true, notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi lấy thông báo' });
    }
};

/**
 * [Client] API đánh dấu thông báo đã đọc
 */
exports.markNotificationRead = async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const notifId = req.params.id;
        
        if (notifId === 'all') {
            await Notification.updateMany({ recipient: userId, read: false }, { $set: { read: true } });
        } else {
            await Notification.findOneAndUpdate({ _id: notifId, recipient: userId }, { $set: { read: true } });
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi cập nhật thông báo' });
    }
};

/**
 * [Client] Gửi yêu cầu thay đổi PT
 * POST /client/pt-change-request
 */
exports.requestPTChange = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        const { currentPTId, reason } = req.body;

        const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

        if (!reason) {
            if (isJson) return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do thay đổi.' });
            req.flash('error_msg', 'Vui lòng nhập lý do thay đổi.');
            return res.redirect('/client');
        }

        await PTChangeRequest.create({
            client: clientId,
            currentPT: currentPTId,
            reason
        });

        // NOTIFY ADMINS / MANAGER
        const managers = await User.find({ role: { $in: ['SA', 'CEO', 'Manager'] }, status: 'Active' });
        for (let manager of managers) {
            await notificationService.pushNotification(
                manager._id,
                'Yêu cầu đổi PT mới',
                `Khách hàng ${req.session.user.name} vừa gửi yêu cầu đổi PT.`,
                'Warning',
                '/admin/pt-change-requests',
                clientId
            );
        }

        if (isJson) {
            return res.json({ success: true, message: 'Yêu cầu thay đổi PT của bạn đã được gửi tới quản lý.' });
        }

        req.flash('success_msg', 'Yêu cầu thay đổi PT của bạn đã được gửi tới quản lý.');
        res.redirect('/client');
    } catch (err) {
        const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
        if (isJson) return res.status(500).json({ success: false, message: err.message });

        req.flash('error_msg', err.message);
        res.redirect('/client');
    }
};

exports.getMealLogHistory = async (req, res, next) => {
  try {
    const clientId = req.session.user.id;
    const mealLogService = require('../../programs/services/mealLogService');
    const MealPlan = require('../../programs/models/mealPlanModel');
    const days = parseInt(req.query.days) || 7;
    const logs = await mealLogService.getRecentLogs(clientId, days);
    const activeMealPlan = await MealPlan.findOne({ client: clientId, status: 'approved', active: true })
      .populate('pt', 'name avatar').lean();
    res.render('client/meal-log-history', { logs, activeMealPlan, days, activePage: 'nutrition' });
  } catch (err) { next(err); }
};
