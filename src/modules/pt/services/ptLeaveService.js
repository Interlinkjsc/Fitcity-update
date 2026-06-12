const Contract = require('../../contracts/models/contractModel');
const PTLeaveRequest = require('../models/ptLeaveRequestModel');
const User = require('../../users/models/userModel');

exports.createLeaveRequest = async (ptId, branchId, { startDate, endDate, reason }) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) throw new Error('Ngày kết thúc phải sau ngày bắt đầu');

    return PTLeaveRequest.create({
        pt: ptId,
        branch: branchId,
        startDate: start,
        endDate: end,
        reason
    });
};

exports.approveWithReassign = async (requestId, managerId, { replacementPtId, managerNote }) => {
    const request = await PTLeaveRequest.findById(requestId);
    if (!request) throw new Error('Không tìm thấy yêu cầu nghỉ');
    if (request.status !== 'Pending') throw new Error('Yêu cầu đã được xử lý');

    if (!replacementPtId) {
        throw new Error('Cần chọn PT thay thế khi duyệt nghỉ giữa kỳ');
    }

    const replacement = await User.findOne({
        _id: replacementPtId,
        role: 'PT',
        status: 'Active'
    });
    if (!replacement) throw new Error('PT thay thế không hợp lệ');

    const result = await Contract.updateMany(
        {
            pt: request.pt,
            contractStatus: { $in: ['Active', 'Draft'] }
        },
        { $set: { pt: replacementPtId } }
    );

    request.status = 'Approved';
    request.replacementPt = replacementPtId;
    request.contractsReassigned = result.modifiedCount || 0;
    request.reviewedBy = managerId;
    request.reviewedAt = new Date();
    if (managerNote) request.managerNote = managerNote;
    await request.save();

    return request;
};

exports.reject = async (requestId, managerId, managerNote) => {
    const request = await PTLeaveRequest.findById(requestId);
    if (!request) throw new Error('Không tìm thấy yêu cầu nghỉ');
    request.status = 'Rejected';
    request.reviewedBy = managerId;
    request.reviewedAt = new Date();
    if (managerNote) request.managerNote = managerNote;
    await request.save();
    return request;
};
