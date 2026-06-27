const WorkoutSession = require('../models/workoutSessionModel');
const User = require('../../users/models/userModel');
const Branch = require('../../crm/models/branchModel');
const notificationService = require('../../platform/services/notificationService');

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

// GET /admin/pt-feedback — Vận hành PT: feedback khách hàng theo chi nhánh
exports.getPtFeedbackList = async (req, res, next) => {
  try {
    const user = req.session.user;
    const branchId = req.query.branchId;
    const sessionFilter = { 'feedback.rating': { $exists: true, $ne: null }, status: { $in: ['Completed', 'Confirmed'] } };

    if (user.role === 'Manager' && user.branch) {
      sessionFilter.branch = user.branch;
    } else if (branchId && branchId !== 'all') {
      sessionFilter.branch = branchId;
    }

    const sessions = await WorkoutSession.find(sessionFilter)
      .populate('client', 'name avatar')
      .populate('pt', 'name')
      .populate('branch', 'name')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    let branches = [];
    if (['SA', 'Admin', 'CEO'].includes(user.role)) {
      branches = await Branch.find().select('name').sort({ name: 1 }).lean();
    }

    res.render('admin/sessions/pt-feedback', { sessions, branches, branchId: branchId || 'all', activePage: 'pt-feedback' });
  } catch (err) { next(err); }
};

// POST /admin/sessions/:id/edit-approve  (sửa giờ rồi duyệt)
exports.editAndApprove = async (req, res, next) => {
  try {
    const { scheduledTime, notes } = req.body;
    const session = await WorkoutSession.findById(req.params.id);
    if (!session) { req.flash('error_msg', 'Không tìm thấy buổi tập.'); return res.redirect('/admin/sessions/pending'); }
    if (session.status !== 'Pending_Admin') { req.flash('error_msg', 'Buổi tập không ở trạng thái chờ duyệt.'); return res.redirect('/admin/sessions/pending'); }
    if (scheduledTime) session.scheduledTime = new Date(scheduledTime);
    if (notes) session.notes = notes;
    session.status = 'Scheduled';
    await session.save();
    await notificationService.pushNotification(session.client, 'Lịch tập đã được duyệt (đã điều chỉnh)', `Lịch tập của bạn đã được duyệt với thời gian điều chỉnh: ${new Date(session.scheduledTime).toLocaleString('vi-VN')}.`, 'Success', '/client/schedule', req.session.user.id);
    await notificationService.pushNotification(session.pt, 'Lịch tập đã được duyệt (đã điều chỉnh)', `Admin đã duyệt lịch tập với thời gian điều chỉnh: ${new Date(session.scheduledTime).toLocaleString('vi-VN')}.`, 'Success', '/pt', req.session.user.id);
    req.flash('success_msg', 'Đã chỉnh sửa và phê duyệt lịch tập.');
    res.redirect('/admin/sessions/pending');
  } catch (err) { next(err); }
};
