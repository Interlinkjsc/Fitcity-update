const WorkoutSession = require('../models/workoutSessionModel.js');
const Contract = require('../../contracts/models/contractModel.js');
const notificationService = require('../../platform/services/notificationService');

async function ensureSessionAndContractUsable(session) {
    if (!session) throw new Error('Buổi tập không tồn tại');
    const contract = await Contract.findById(session.contract);
    if (!contract || contract.contractStatus !== 'Active') {
        const status = contract ? contract.contractStatus : 'N/A';
        throw new Error(`Không thể thực hiện. Hợp đồng đang ở trạng thái: ${status}.`);
    }
    if (contract.remainingSessions <= 0) {
        throw new Error('Hợp đồng đã hết số buổi tập.');
    }
    return contract;
}

async function ensureNoDoubleBooking(session, sessionId) {
    const activeSession = await WorkoutSession.findOne({
        client: session.client,
        status: 'In_Progress',
        _id: { $ne: sessionId }
    });
    if (activeSession) {
        throw new Error('Khách hàng này đang có một buổi tập khác diễn ra (In Progress).');
    }
}

exports.ptStartSessionByQr = async (sessionId, ptId) => {
    const session = await WorkoutSession.findById(sessionId);
    await ensureSessionAndContractUsable(session);
    if (String(session.pt) !== String(ptId)) {
        throw new Error('Bạn không có quyền bắt đầu buổi tập này.');
    }
    if (session.status !== 'Scheduled') {
        throw new Error('Buổi tập không ở trạng thái Scheduled.');
    }
    await ensureNoDoubleBooking(session, sessionId);

    session.startTime = new Date();
    session.status = 'In_Progress';
    await session.save();
    return session;
};

exports.ptEndSessionByQr = async (sessionId, ptId) => {
    const session = await WorkoutSession.findById(sessionId);
    await ensureSessionAndContractUsable(session);
    if (String(session.pt) !== String(ptId)) {
        throw new Error('Bạn không có quyền kết thúc buổi tập này.');
    }
    if (session.status !== 'In_Progress') {
        throw new Error('Buổi tập không ở trạng thái đang diễn ra!');
    }

    session.status = 'Completed';
    session.endTime = new Date();
    await session.save();
    return session;
};

exports.processQrScan = async (sessionId, authUserId) => {
    const session = await WorkoutSession.findById(sessionId);
    await ensureSessionAndContractUsable(session);

    if (String(session.pt) !== String(authUserId)) {
        throw new Error('Bạn không có quyền thao tác trên buổi tập này.');
    }

    if (session.status === 'Completed' || session.status === 'Confirmed' || session.status === 'Cancelled') {
        throw new Error('Buổi tập đã kết thúc hoặc bị hủy.');
    }

    if (session.status === 'Scheduled') {
        await ensureNoDoubleBooking(session, sessionId);
        session.startTime = new Date();
        session.status = 'In_Progress';
        await session.save();
        return session;
    }

    if (session.status === 'In_Progress') {
        session.endTime = new Date();
        session.status = 'Completed';
        await session.save();

        // Gửi push notification yêu cầu Client xác nhận
        try {
            await notificationService.pushNotification(
                session.client,
                'Yêu cầu xác nhận buổi tập',
                'Buổi tập với HLV đã hoàn thành. Vui lòng xác nhận trên App để hoàn tất thủ tục chốt buổi!',
                'Info',
                '/client',
                session.pt
            );
        } catch (_notifErr) {
            // Không block luồng chính nếu notification lỗi
        }

        return session;
    }
    
    return session;
};

