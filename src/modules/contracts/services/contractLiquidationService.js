const Contract = require('../models/contractModel.js');
const WorkoutSession = require('../../programs/models/workoutSessionModel.js');

/**
 * Service to handle automatic liquidation of contracts
 * Rules:
 * 1. 15 days payment deadline: If not paid full after 15 days, liquidate.
 * 2. 12 months freeze limit: If frozen for more than 12 months, liquidate.
 */
exports.runContractCleanup = async () => {
    const now = new Date();
    const results = {
        liquidatedByPayment: 0,
        liquidatedByFreeze: 0
    };

    // 1. Check Payment Deadline (15 days)
    // Find contracts that are NOT fully paid and passed the deadline
    const unpaidContracts = await Contract.find({
        paymentStatus: { $ne: 'Paid' },
        paymentDeadline: { $lte: now },
        contractStatus: { $nin: ['Cancelled', 'Liquidated'] }
    });

    for (const contract of unpaidContracts) {
        contract.contractStatus = 'Liquidated';
        contract.notes = (contract.notes || '') + `\n[${now.toLocaleDateString()}] Tự động thanh lý do không đóng đủ tiền sau 15 ngày.`;
        await contract.save();
        results.liquidatedByPayment++;
    }

    // 2. Check Freeze Limit (12 months)
    // Find contracts that are frozen and passed 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const overFrozenContracts = await Contract.find({
        isFrozen: true,
        frozenAt: { $lte: twelveMonthsAgo },
        contractStatus: { $nin: ['Cancelled', 'Liquidated'] }
    });

    for (const contract of overFrozenContracts) {
        contract.contractStatus = 'Liquidated';
        contract.notes = (contract.notes || '') + `\n[${now.toLocaleDateString()}] Tự động thanh lý do bảo lưu quá 12 tháng.`;
        await contract.save();
        results.liquidatedByFreeze++;
    }

    return results;
};
