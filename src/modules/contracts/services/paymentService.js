const PaymentTransaction = require('../models/transactionModel.js');
const Contract = require('../models/contractModel.js');

/**
 * Tạo một giao dịch thanh toán mới và cập nhật hợp đồng tương ứng.
 * @param {Object} data - Dữ liệu thanh toán
 * @param {string} data.contractId - ID hợp đồng
 * @param {string} data.clientId - ID khách hàng
 * @param {number} data.amount - Số tiền thanh toán
 * @param {string} data.transactionType - Loại giao dịch (Deposit, Full_Payment, Installment, Balance_Payment)
 * @param {string} data.paymentMethod - Phương thức (Cash, Transfer, Card)
 * @param {string} [data.notes] - Ghi chú
 * @param {string} [data.processedBy] - Người xử lý (staff ID)
 * @returns {Object} { transaction, contract }
 */
exports.createPayment = async (data) => {
    const { contractId, clientId, amount, transactionType, paymentMethod, notes, processedBy } = data;

    // 1. Validate contract exists
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Hợp đồng không tồn tại');

    // 2. Validate amount
    if (!amount || amount <= 0) throw new Error('Số tiền phải lớn hơn 0');

    const remainingDebt = contract.totalAmount - contract.paidAmount;
    if (amount > remainingDebt) {
        throw new Error(`Số tiền thanh toán (${amount.toLocaleString('vi-VN')} VNĐ) vượt quá công nợ còn lại (${remainingDebt.toLocaleString('vi-VN')} VNĐ)`);
    }

    // 3. Create transaction record
    const transaction = await PaymentTransaction.create({
        contractId,
        clientId,
        amount,
        transactionType,
        paymentMethod,
        notes: notes || '',
        processedBy,
        status: 'Success'
    });

    // 4. Update contract's paidAmount and paymentStatus
    const newPaidAmount = contract.paidAmount + amount;
    const updateData = { paidAmount: newPaidAmount };

    if (newPaidAmount >= contract.totalAmount) {
        updateData.paymentStatus = 'Paid';
        updateData.contractStatus = 'Active';
        updateData.paidAt = new Date();
    } else if (newPaidAmount > 0) {
        updateData.paymentStatus = 'Deposit';
        updateData.contractStatus = 'Active'; // Deposit → allow scheduling
    }

    // Also track payment method used
    const existingMethods = contract.paymentMethods || [];
    if (!existingMethods.includes(paymentMethod)) {
        updateData.paymentMethods = [...existingMethods, paymentMethod];
    }

    const updatedContract = await Contract.findByIdAndUpdate(contractId, updateData, { new: true });

    if (updatedContract && updatedContract.paymentStatus === 'Paid') {
        try {
            const affiliateService = require('../../programs/services/affiliateService');
            await affiliateService.processReferralRewardOnPaid(updatedContract);
        } catch (e) {
            console.warn('[Affiliate] reward on payment failed:', e.message);
        }
    }

    return { transaction, contract: updatedContract };
};

/**
 * Lấy lịch sử thanh toán của một hợp đồng.
 * @param {string} contractId - ID hợp đồng
 * @returns {Array} Danh sách giao dịch
 */
exports.getPaymentHistory = async (contractId) => {
    const transactions = await PaymentTransaction.find({ contractId })
        .populate('processedBy', 'name')
        .sort({ createdAt: -1 });
    return transactions;
};

/**
 * Lấy chi tiết một giao dịch thanh toán (dùng cho preview Phiếu Thu).
 * @param {string} transactionId - ID giao dịch
 * @returns {Object} Giao dịch kèm populate
 */
exports.getTransactionDetail = async (transactionId) => {
    const transaction = await PaymentTransaction.findById(transactionId)
        .populate('contractId')
        .populate('clientId', 'name email phone')
        .populate('processedBy', 'name');
    if (!transaction) throw new Error('Không tìm thấy giao dịch');
    return transaction;
};
