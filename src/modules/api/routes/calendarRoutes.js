const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { protect } = require('../../../middlewares/authMiddleware');

// Áp dụng middleware protect cho toàn bộ API calendar
router.use(protect);

// GET /api/calendar/sessions
router.get('/sessions', calendarController.getSessions);

// PATCH /api/calendar/sessions/:id/cancel
router.patch('/sessions/:id/cancel', calendarController.cancelSession);

// POST /api/calendar/sessions/:id/scan-qr
router.post('/sessions/:id/scan-qr', calendarController.scanQr);

module.exports = router;
