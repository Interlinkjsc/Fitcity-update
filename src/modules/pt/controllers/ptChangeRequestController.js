const PTChangeRequest = require('../models/ptChangeRequestModel.js');
const User = require('../../users/models/userModel.js');
const Contract = require('../../contracts/models/contractModel.js');
const notificationService = require('../../platform/services/notificationService');
const socketService = require('../../platform/services/socketService.js');

exports.getPTChangeRequests = async (req, res, next) => {
    try {
        const requests = await PTChangeRequest.find()
            .populate('client', 'name phone')
            .populate('currentPT', 'name')
            .populate('processedBy', 'name')
            .sort({ createdAt: -1 });

        const pts = await User.find({ role: 'PT', status: 'Active' })
            .select('name')
            .sort({ name: 1 })
            .lean();

        res.render('admin/pt-change-requests/index', {
            requests,
            pts,
            title: 'Yêu cầu thay đổi PT'
        });
    } catch (err) {
        next(err);
    }
};

exports.updatePTChangeRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, adminNote, newPTId } = req.body;

        const request = await PTChangeRequest.findById(id);
        if (!request) {
            req.flash('error_msg', 'Không tìm thấy yêu cầu.');
            return res.redirect('/admin/pt-change-requests');
        }

        if (status === 'Approved') {
            if (!newPTId) {
                req.flash('error_msg', 'Vui lòng chọn PT mới khi chấp thuận yêu cầu.');
                return res.redirect('/admin/pt-change-requests');
            }

            await Contract.updateMany(
                { client: request.client, contractStatus: 'Active' },
                { $set: { pt: newPTId } }
            );
        }

        request.status = status;
        request.adminNote = adminNote;
        request.processedBy = req.session.user.id;
        await request.save();

        const statusText = status === 'Approved' ? 'được CHẤP THUẬN' : 'bị TỪ CHỐI';
        await notificationService.pushNotification(
            request.client,
            'Kết quả yêu cầu đổi PT',
            `Yêu cầu thay đổi PT của bạn đã ${statusText}. ${adminNote ? 'Ghi chú: ' + adminNote : ''}`,
            status === 'Approved' ? 'Success' : 'Danger',
            '/client',
            req.session.user.id
        );

        socketService.sendToUser(request.client, 'notification', {
            title: 'Kết quả yêu cầu đổi PT',
            message: `Yêu cầu thay đổi PT của bạn đã ${statusText}.`,
            type: status === 'Approved' ? 'Success' : 'Danger'
        });

        req.flash('success_msg', `Đã cập nhật yêu cầu: ${status}`);
        res.redirect('/admin/pt-change-requests');
    } catch (err) {
        next(err);
    }
};

