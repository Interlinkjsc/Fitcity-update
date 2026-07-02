const paymentService = require('../services/paymentService');
const Contract = require('../models/contractModel.js');
const notificationService = require('../../platform/services/notificationService');
const contractScope = require('../services/contractScopeService');

function denyContractAccess(req, res, contract) {
    req.flash(
        'error_msg',
        contract ? contractScope.ACCESS_DENIED_MSG : 'Không tìm thấy hợp đồng!'
    );
    return res.redirect('/admin/contracts/list');
}

/**
 * [POST] /admin/contracts/:id/payments/store
 * Tạo đợt thanh toán mới cho hợp đồng
 */
exports.storePayment = async (req, res, next) => {
    try {
        const contractId = req.params.id;
        const { amount, transactionType, paymentMethod, notes } = req.body;

        // Lấy contract để biết clientId
        const contract = await Contract.findById(contractId);
        if (!contractDoc) {
            return denyContractAccess(req, res, null);
        }
        if (!contractScope.canAccessContract(req.session.user, contractDoc)) {
            return denyContractAccess(req, res, contract);
        }

        const { transaction, contract: updatedContract } = await paymentService.createPayment({
            contractId,
            clientId: contract.client,
            amount: Number(amount),
            transactionType,
            paymentMethod,
            notes,
            processedBy: req.session.user.id
        });

        // Gửi thông báo cho khách hàng (kèm link xem phiếu thu trực tiếp)
        await notificationService.pushNotification(
            contract.client,
            'Xác nhận thanh toán',
            `Phiếu thu ${transaction.receiptNumber} - Đã ghi nhận ${Number(amount).toLocaleString('vi-VN')} VNĐ cho hợp đồng ${updatedContract.contractCode}. Bấm để xem phiếu thu.`,
            'Success',
            `/client/contracts/${contractId}/receipt/${transaction._id}`
        );

        req.flash('success_msg', `Ghi nhận thanh toán thành công! Phiếu thu: ${transaction.receiptNumber}`);
        res.redirect(`/admin/contracts/detail/${contractId}`);
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect(`/admin/contracts/detail/${req.params.id}`);
    }
};

/**
 * [GET] /admin/contracts/:id/preview/contract
 * Preview Hợp đồng dạng HTML (dùng cho Modal hoặc Tab mới)
 */
exports.previewContract = async (req, res, next) => {
    try {
        const contractDoc = await Contract.findById(req.params.id)
            .populate('client', 'name email phone cccdNumber cccdIssueDate cccdIssuePlace address dob emergencyContact')
            .populate('servicePackage', 'name price durationInMonths maxSessions type')
            .populate('pt', 'name phone')
            .populate('branch', 'name address')
            .populate('sales', 'name');
        const contract = contractDoc ? contractDoc.toObject({ getters: true }) : null;

        if (!contract) {
            return denyContractAccess(req, res, null);
        }
        if (!contractScope.canAccessContract(req.session.user, contract)) {
            return denyContractAccess(req, res, contract);
        }

        // Render template preview (full page, không dùng layout admin)
        res.render('admin/contracts/templates/contract-preview', {
            contract,
            layout: false // Không dùng layout admin, render full page cho in ấn
        });
    } catch (err) {
        next(err);
    }
};

/**
 * [GET] /admin/contracts/:id/preview/receipt/:transactionId
 * Preview Phiếu Thu dạng HTML (dùng cho Modal hoặc Tab mới)
 */
exports.previewReceipt = async (req, res, next) => {
    try {
        const transaction = await paymentService.getTransactionDetail(req.params.transactionId);

        // Lấy thêm thông tin hợp đồng đầy đủ
        const contract = await Contract.findById(req.params.id)
            .populate('client', 'name email phone')
            .populate('branch', 'name address')
            .populate('servicePackage', 'name')
            .lean();
        if (contract) require('../../../utils/decryptLean').decryptPeople(contract, ['client']);

        if (!contract) {
            return denyContractAccess(req, res, null);
        }
        if (!contractScope.canAccessContract(req.session.user, contract)) {
            return denyContractAccess(req, res, contract);
        }

        // Render template phiếu thu
        res.render('admin/contracts/templates/receipt-preview', {
            transaction: transaction.toObject(),
            contract,
            layout: false
        });
    } catch (err) {
        next(err);
    }
};
