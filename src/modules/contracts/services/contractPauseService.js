const Contract = require('../models/contractModel.js');
const WorkoutSession = require('../../programs/models/workoutSessionModel.js');

/**
 * Pause a contract
 */
exports.pauseContract = async (contractId, durationDays, reason) => {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Hợp đồng không tồn tại');

    if (contract.contractStatus !== 'Active') {
        throw new Error(`Chỉ có thể bảo lưu hợp đồng đang Active (Trạng thái hiện tại: ${contract.contractStatus})`);
    }

    const today = new Date();
    const endDate = contract.currentEndDate || contract.endDate;

    // Validation 1: Contract has at least 15 days left
    const daysLeft = (endDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
    if (daysLeft < 15) {
        throw new Error('Hợp đồng phải còn hạn ít nhất 15 ngày mới được bảo lưu');
    }

    // Validation 1.5: Valid duration (Mới: Tối đa 12 tháng)
    if (durationDays < 7 || durationDays > 365) {
        throw new Error('Thời gian bảo lưu tối thiểu 7 ngày và tối đa 12 tháng (365 ngày)');
    }

    // Validation 2: Cumulative pause must not exceed 60 days
    const totalPausedDays = contract.pauseHistory.reduce((sum, p) => sum + (p.duration || 0), 0);
    if (totalPausedDays + durationDays > 60) {
        throw new Error('Tổng thời gian bảo lưu không được quá 60 ngày');
    }

    const pauseStartDate = new Date();
    const pauseEndDate = new Date();
    pauseEndDate.setDate(pauseStartDate.getDate() + durationDays);

    contract.pauseHistory.push({
        startDate: pauseStartDate,
        endDate: pauseEndDate,
        reason: reason + ` (Phí bảo lưu dự kiến: 200.000 VNĐ/tháng)`,
        duration: durationDays
    });

    contract.contractStatus = 'Paused';
    contract.isFrozen = true;
    contract.frozenAt = pauseStartDate;
    contract.freezeFee = 200000;
    
    // Disable any scheduled workout sessions during the pause period
    await WorkoutSession.updateMany(
        { 
            contract: contract._id, 
            status: 'Scheduled',
            scheduledTime: { $gte: pauseStartDate, $lte: pauseEndDate }
        },
        { status: 'Cancelled' }
    );

    await contract.save();
    return contract;
};

/**
 * Unpause a contract manually before the pause duration ends.
 */
exports.unpauseContract = async (contractId) => {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Hợp đồng không tồn tại');

    if (contract.contractStatus !== 'Paused') {
        throw new Error('Hợp đồng không ở trạng thái bảo lưu');
    }

    // Find the latest pause event
    const lastPause = contract.pauseHistory[contract.pauseHistory.length - 1];
    if (!lastPause) throw new Error('Lịch sử bảo lưu không hợp lệ');

    const today = new Date();

    // Actual paused days
    const actualPausedTime = today.getTime() - lastPause.startDate.getTime();
    let actualPausedDays = Math.ceil(actualPausedTime / (1000 * 3600 * 24));
    
    // If unpaused exactly on the same day it was paused, ensure at least 1 day extension to be safe or 0
    if (actualPausedDays < 0) actualPausedDays = 0;
    
    // Update the actual duration of the last pause
    contract.pauseHistory[contract.pauseHistory.length - 1].endDate = today;
    contract.pauseHistory[contract.pauseHistory.length - 1].duration = actualPausedDays;

    // Extend the current end date by the actual paused days
    const currentEnd = contract.currentEndDate || contract.endDate;
    const newEndDate = new Date(currentEnd);
    newEndDate.setDate(newEndDate.getDate() + actualPausedDays);

    contract.currentEndDate = newEndDate;
    contract.endDate = newEndDate; // Also sync endDate for standard queries
    contract.contractStatus = 'Active';
    contract.isFrozen = false;
    contract.frozenAt = null;

    await contract.save();
    return contract;
};
