const WorkoutSession = require('../models/workoutSessionModel');
const User = require('../../users/models/userModel');
const notificationService = require('../../platform/services/notificationService');

function parseVNDateTime(str) {
    if (!str) return null;
    const s = str.length === 16 ? str + ':00' : str.substring(0, 19);
    return new Date(s + '+07:00');
}

// GET /admin/sessions/pending
exports.getPendingList = async (req, res, next) => {
  try {
    const sessions = await WorkoutSession.find({ status: 'Pending_Admin' })
      .populate('client', 'name email avatar')
      .populate('pt', 'name avatar')
      .populate('contract', 'contractCode packageSnapshot')
      .populate('branch', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.render('admin/sessions/pending-list', { sessions, activePage: 'session-approval' });
  } catch (err) { next(err); }
};

// POST /admin/sessions/:id/approve
exports.approveSession = async (req, res, next) => {
  try {
    const session = await WorkoutSession.findById(req.params.id);
    if (!session) { req.flash('error_msg', 'Không tìm thấy buổi tập.'); return res.redirect('/admin/sessions/pending'); }
    if (session.status !== 'Pending_Admin') { req.flash('error_msg', 'Buổi tập không ở trạng thái chờ duyệt.'); return res.redirect('/admin/sessions/pending'); }
    session.status = 'Scheduled';
    await session.save();
    await notificationService.pushNotification(session.client, 'Lịch tập đã được duyệt', `Lịch tập của bạn vào lúc ${new Date(session.scheduledTime).toLocaleString('vi-VN')} đã được Admin phê duyệt.`, 'Success', '/client/schedule', req.session.user.id);
    await notificationService.pushNotification(session.pt, 'Lịch tập đã được duyệt', `Admin đã phê duyệt lịch tập bạn tạo cho khách hàng vào lúc ${new Date(session.scheduledTime).toLocaleString('vi-VN')}.`, 'Success', '/pt', req.session.user.id);
    req.flash('success_msg', 'Đã phê duyệt lịch tập thành công.');
    res.redirect('/admin/sessions/pending');
  } catch (err) { next(err); }
};

// POST /admin/sessions/:id/reject
exports.rejectSession = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const session = await WorkoutSession.findById(req.params.id);
    if (!session) { req.flash('error_msg', 'Không tìm thấy buổi tập.'); return res.redirect('/admin/sessions/pending'); }
    if (session.status !== 'Pending_Admin') { req.flash('error_msg', 'Buổi tập không ở trạng thái chờ duyệt.'); return res.redirect('/admin/sessions/pending'); }
    session.status = 'Cancelled';
    if (reason) session.notes = (session.notes ? session.notes + ' | ' : '') + 'Từ chối: ' + reason;
    await session.save();
    await notificationService.pushNotification(session.client, 'Lịch tập bị từ chối', `Lịch tập vào lúc ${new Date(session.scheduledTime).toLocaleString('vi-VN')} đã bị từ chối. Lý do: ${reason || 'Không có'}`, 'Error', '/client/schedule', req.session.user.id);
    await notificationService.pushNotification(session.pt, 'Lịch tập bị từ chối', `Admin đã từ chối lịch tập bạn tạo. Lý do: ${reason || 'Không có'}`, 'Error', '/pt', req.session.user.id);
    req.flash('success_msg', 'Đã từ chối lịch tập.');
    res.redirect('/admin/sessions/pending');
  } catch (err) { next(err); }
};

// POST /admin/sessions/:id/edit-approve  (sửa giờ rồi duyệt)
exports.editAndApprove = async (req, res, next) => {
  try {
    const { scheduledTime, notes } = req.body;
    const session = await WorkoutSession.findById(req.params.id);
    if (!session) { req.flash('error_msg', 'Không tìm thấy buổi tập.'); return res.redirect('/admin/sessions/pending'); }
    if (session.status !== 'Pending_Admin') { req.flash('error_msg', 'Buổi tập không ở trạng thái chờ duyệt.'); return res.redirect('/admin/sessions/pending'); }
    if (scheduledTime) session.scheduledTime = parseVNDateTime(scheduledTime);
    if (notes) session.notes = notes;
    session.status = 'Scheduled';
    await session.save();
    await notificationService.pushNotification(session.client, 'Lịch tập đã được duyệt (đã điều chỉnh)', `Lịch tập của bạn đã được duyệt với thời gian điều chỉnh: ${new Date(session.scheduledTime).toLocaleString('vi-VN')}.`, 'Success', '/client/schedule', req.session.user.id);
    await notificationService.pushNotification(session.pt, 'Lịch tập đã được duyệt (đã điều chỉnh)', `Admin đã duyệt lịch tập với thời gian điều chỉnh: ${new Date(session.scheduledTime).toLocaleString('vi-VN')}.`, 'Success', '/pt', req.session.user.id);
    req.flash('success_msg', 'Đã chỉnh sửa và phê duyệt lịch tập.');
    res.redirect('/admin/sessions/pending');
  } catch (err) { next(err); }
};
