const cron = require('node-cron');
const Contract = require('../modules/contracts/models/contractModel.js');
const mongoose = require('mongoose');

const startCronJobs = () => {
    // Run everyday at 00:00 (Midnight)
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Starting daily contract liquidation check...');
        try {
            const now = new Date();
            
            // 1. Thanh lý hợp đồng nợ quá 15 ngày (Chưa đóng đủ tiền)
            const unpaidContracts = await Contract.find({
                contractStatus: { $nin: ['Cancelled', 'Liquidated'] },
                paymentStatus: { $ne: 'Paid' },
                paymentDeadline: { $lte: now }
            });
 
            for (let contract of unpaidContracts) {
                contract.contractStatus = 'Liquidated';
                contract.notes = (contract.notes || '') + `\n[Hệ thống] Tự động thanh lý do không đóng đủ tiền sau 15 ngày (Hạn: ${contract.paymentDeadline.toLocaleDateString('vi-VN')})`;
                await contract.save();
                console.log(`[CRON] Liquidated contract ${contract.contractCode} (Unpaid > 15 days)`);
            }
 
            // 2. Thanh lý hợp đồng bảo lưu quá 12 tháng
            const twelveMonthsAgo = new Date();
            twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
            
            const overPausedContracts = await Contract.find({
                contractStatus: { $ne: 'Liquidated' },
                $or: [
                    { isFrozen: true, frozenAt: { $lte: twelveMonthsAgo } },
                    { contractStatus: 'Paused', updatedAt: { $lte: twelveMonthsAgo } } // Backup check
                ]
            });
 
            for (let contract of overPausedContracts) {
                contract.contractStatus = 'Liquidated';
                contract.notes = (contract.notes || '') + '\n[Hệ thống] Tự động thanh lý do bảo lưu quá hạn 12 tháng (Phí bảo lưu: 200k/tháng).';
                await contract.save();
                console.log(`[CRON] Liquidated contract ${contract.contractCode} (Frozen > 12 months)`);
            }

            console.log('[CRON] Contract liquidation check completed.');
        } catch (err) {
            console.error('[CRON] Error during contract liquidation:', err);
        }
    });
};

module.exports = { startCronJobs };
