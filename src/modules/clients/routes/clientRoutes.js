const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const clientScheduleController = require('../controllers/clientScheduleController');
const metricController = require('../../programs/controllers/metricController');
const { protect, restrictTo } = require('../../../middlewares/authMiddleware');

// Chỉ hội viên mới được thực hiện các action này
router.use(protect);
router.use(restrictTo('Client'));

// POST /client/sessions/confirm/:id
router.post('/sessions/confirm/:id', clientController.confirmSession);

// POST /client/sessions/:id/feedback
router.post('/sessions/:id/feedback', clientController.submitSessionFeedback);
router.post('/sessions/:id/cancel-request', clientController.requestCancelSession);

// POST /client/contracts/pause (Xin bảo lưu)
router.post('/contracts/pause', clientController.requestPause);

// POST /client/pt-change-request (Yêu cầu đổi PT)
router.post('/pt-change-request', clientController.requestPTChange);

// GET /client/workouts (Thư viện bài tập/Lịch tập)
router.get('/workouts', clientController.getWorkouts);

// GET /client/rewards (Ưu đãi / Voucher của tôi)
router.get('/rewards', clientController.getMyRewards);

// POST /client/meal-log — nhật ký bữa ăn hàng ngày
router.post('/meal-log', clientController.logMeal);

// GET /client/sessions/:id/qr?action=start|end (Hiển thị QR cho PT quét)
router.get('/sessions/:id/qr', clientController.getSessionQr);

// GET /client/notifications (Lấy danh sách thông báo)
router.get('/notifications', clientController.getNotifications);

// POST /client/notifications/:id/read (Đánh dấu đã đọc)
router.post('/notifications/:id/read', clientController.markNotificationRead);

// ========== CLIENT SCHEDULE (PT SLOT BOOKING) ==========
// GET /client/schedule - Xem slot PT mở sẵn
router.get('/schedule', clientScheduleController.getSchedule);
// POST /client/schedule/request - Gửi yêu cầu đặt slot
router.post('/schedule/request', clientScheduleController.requestBooking);

// POST /client/sessions/:id/reschedule-request - Gửi yêu cầu đổi lịch (slot mới)
router.post('/sessions/:id/reschedule-request', clientScheduleController.requestReschedule);

// ========== CONTRACTS & RECEIPTS (Phase 3) ==========

// GET /client/contracts - Danh sách hợp đồng của khách hàng
router.get('/contracts', clientController.getMyContracts);

// GET /client/contracts/:id/preview - Xem hợp đồng (HTML preview)
router.get('/contracts/:id/preview', clientController.previewMyContract);

// GET /client/contracts/:id/receipt/:transactionId - Xem phiếu thu (HTML preview)
router.get('/contracts/:id/receipt/:transactionId', clientController.previewMyReceipt);

router.get('/metrics/add', protect, metricController.getClientAddMetricForm);
router.post('/metrics/add', protect, metricController.clientSaveBodyMetric);
router.get('/meal-log/history', protect, clientController.getMealLogHistory);

module.exports = router;
