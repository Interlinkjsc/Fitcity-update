const Contract = require('../models/contractModel.js');
const ServicePackage = require('../../programs/models/servicePackageModel.js');
const Branch = require('../../crm/models/branchModel.js');
const User = require('../../users/models/userModel.js');
const contractService = require('../services/contractService');
const contractPauseService = require('../services/contractPauseService');
const pdfService = require('../services/pdfService');
const driveService = require('../../platform/services/driveService');
const fs = require('fs');
const path = require('path');
const notificationService = require('../../platform/services/notificationService');
const mongoose = require('mongoose');
const permissionService = require('../../../core/permissionService');
const { decrypt } = require('../../../utils/encryption');

const PAYMENT_STATUS_ALLOWED = new Set(['Paid', 'Deposit', 'Unpaid', 'Pending_Paid']);
const PAYMENT_METHODS_ALLOWED = new Set(['Cash', 'Transfer', 'Card', 'Installment']);
const REVENUE_SOURCE_ALLOWED = new Set(['PT_Contract', 'Other']);

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(String(id || ''));
}

/**
 * Xuất file PDF Hợp đồng
 */
exports.downloadContract = async (req, res, next) => {
    try {
        const contract = await Contract.findById(req.params.id)
            .populate('client')
            .populate('servicePackage')
            .populate('pt')
            .populate('branch');

        if (!contract) {
            return denyContractAccess(req, res, null);
        }
        if (!contractScope.canAccessContract(req.session.user, contract)) {
            return denyContractAccess(req, res, contract);
        }

        const fileName = `Contract_${contract.contractCode || contract._id}.pdf`;
        const tempPath = path.join(__dirname, '../../../tmp', fileName);

        // Ensure tmp dir exists
        const tmpDir = path.join(__dirname, '../../../tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

        await pdfService.generateContractPDF(contract, tempPath);

        // SYNC TO GDRIVE: Upload only if not already on drive
        if (!contract.googleDriveFileId) {
            const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'fitcity_contracts';
            const driveId = await driveService.uploadToDrive(tempPath, fileName, folderId);
            if (driveId) {
                await driveService.attachDriveIdToContract(contract._id, driveId);
            }
        }

        res.download(tempPath, fileName, (err) => {
            if (err) next(err);
            // Delete temp local file after download/upload
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch(e) {}
        });
    } catch (err) {
        next(err);
    }
};

const { getPagination } = require('../../../utils/paginationHelper');
const contractScope = require('../services/contractScopeService');

function denyContractAccess(req, res, contract, redirectTo = '/admin/contracts/list') {
    req.flash(
        'error_msg',
        contract ? contractScope.ACCESS_DENIED_MSG : 'Không tìm thấy hợp đồng!'
    );
    return res.redirect(redirectTo);
}

// 1. Hiển thị danh sách Hợp đồng
exports.getContractList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const user = req.session.user;

        const listFilter = contractScope.buildContractListFilter(user, req.query);

        const totalDocs = await Contract.countDocuments(listFilter);
        const contracts = await Contract.find(listFilter)
            .populate('client', 'name email phone')
            .populate('servicePackage', 'name type price duration')
            .populate('pt', 'name')
            .populate('sales', 'name')
            .populate('branch', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const pagination = getPagination(totalDocs, page, limit);

        const contractBaseMatch = { ...listFilter, contractStatus: { $ne: 'Cancelled' } };

        const revenueStats = await Contract.aggregate([
            { $match: contractBaseMatch },
            { $group: contractScope.revenueAggregateGroup() }
        ]);
        const revSummary = revenueStats[0] || { totalNet: 0, totalAfterTax: 0, totalPaid: 0, count: 0 };

        const pendingResult = await Contract.aggregate([
            { $match: contractBaseMatch },
            { $project: { pending: { $subtract: ['$totalAmount', '$paidAmount'] } } },
            { $group: { _id: null, totalPending: { $sum: '$pending' } } }
        ]);
        const pendingReceivables = pendingResult[0] ? pendingResult[0].totalPending : 0;

        let branches = [];
        if (contractScope.GLOBAL_VIEW_ROLES.includes(user.role)) {
            branches = await Branch.find().select('name').sort({ name: 1 }).lean();
        } else if (user.role === 'Manager' && user.branch) {
            branches = await Branch.find({ _id: user.branch }).select('name').lean();
        }

        await permissionService.ensureCache();
        const canManageContract = permissionService.userHasPermissionSync(user, 'contract', 'manage');
        const canDeleteContract = permissionService.userHasPermissionSync(user, 'contract', 'delete');

        res.render('admin/contracts/list', {
            contracts,
            pagination,
            query: req.query,
            branches,
            totalAfterTax: revSummary.totalAfterTax,
            totalBeforeTax: Math.round(revSummary.totalNet || 0),
            totalPaid: revSummary.totalPaid,
            pendingReceivables,
            canManageContract,
            canDeleteContract
        });
    } catch (err) {
        next(err);
    }
};

// 2. Form Tạo Hợp đồng mới
exports.getCreateForm = async (req, res, next) => {
    try {
        // Cần truyền list options cho dropdowns
        const clients = await User.find({ role: 'Client', status: 'Active' })
            .select('name phone email branch _id')
            .lean();
        const packages = await ServicePackage.find({ status: 'Active' }).lean();
        const branches = await Branch.find({ status: { $ne: 'Closed' } }).lean();
        if (branches.length === 0) {
            req.flash('error_msg', 'Chưa có chi nhánh. Vui lòng liên hệ quản trị viên.');
            const back = req.originalUrl.startsWith('/pt') ? '/pt' : '/admin/contracts/list';
            return res.redirect(back);
        }

        const pts = await User.find({ role: 'PT', status: 'Active' })
            .select('name _id')
            .lean();

        let salesStaff = await User.find({
            role: { $in: ['Sales', 'Manager', 'Admin', 'SA', 'PT', 'Marketing', 'CEO', 'Accountant'] },
            status: 'Active'
        })
            .select('name _id role')
            .lean();

        const formAction = req.originalUrl.startsWith('/pt') ? '/pt/contracts/store' : '/admin/contracts/store';
        const backUrl = req.originalUrl.startsWith('/pt') ? '/pt' : '/admin/contracts/list';

        const viewPath = req.user && req.user.role === 'PT' ? 'pt/contracts/create' : 'admin/contracts/form';
        const currentUserId = req.session.user ? String(req.session.user.id) : null;

        res.render(viewPath, {
            isEdit: false,
            contract: new Contract(),
            clients,
            packages,
            branches,
            salesStaff,
            pts,
            formAction,
            backUrl,
            currentUserId
        });
    } catch (err) {
        next(err);
    }
};

// 3. Xử lý Thêm mới (Logic tài chính nằm ở contractService)
exports.storeContract = async (req, res, next) => {
    try {
        const {
            client,
            servicePackage,
            branch,
            sales,
            pt,
            discount,
            couponCode,
            paymentStatus,
            paymentMethods,
            notes,
            revenueSource
        } = req.body;
        const { customPkgName, customPkgType, customPkgDuration, customPkgSessions, customPkgPrice } = req.body;
        const back = req.originalUrl.startsWith('/pt') ? '/pt/contracts/create' : '/admin/contracts/create';

        // Default sales to current logged-in user if not provided
        const salesId = (sales && isValidObjectId(sales)) ? sales : String(req.session.user.id);

        if (!isValidObjectId(client) || !isValidObjectId(branch) || !isValidObjectId(salesId)) {
            req.flash('error_msg', 'Thông tin khách hàng/chi nhánh/sales không hợp lệ.');
            return res.redirect(back);
        }
        if (pt && !isValidObjectId(pt)) {
            req.flash('error_msg', 'Huấn luyện viên không hợp lệ.');
            return res.redirect(back);
        }
        const discountNum = Number(discount);
        if (!Number.isFinite(discountNum) || discountNum < 0) {
            req.flash('error_msg', 'Chiết khấu phải là số không âm.');
            return res.redirect(back);
        }
        if (paymentStatus && !PAYMENT_STATUS_ALLOWED.has(paymentStatus)) {
            req.flash('error_msg', 'Trạng thái bill không hợp lệ.');
            return res.redirect(back);
        }
        if (paymentMethods) {
            const normalizedMethods = Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods];
            if (normalizedMethods.some((m) => !PAYMENT_METHODS_ALLOWED.has(m))) {
                req.flash('error_msg', 'Phương thức thanh toán không hợp lệ.');
                return res.redirect(back);
            }
        }
        if (revenueSource && !REVENUE_SOURCE_ALLOWED.has(revenueSource)) {
            req.flash('error_msg', 'Nguồn thu không hợp lệ.');
            return res.redirect(back);
        }
        if (couponCode && !/^[A-Za-z0-9_-]{2,32}$/.test(String(couponCode).trim())) {
            req.flash('error_msg', 'Mã giảm giá không hợp lệ.');
            return res.redirect(back);
        }
        if (notes && String(notes).length > 1000) {
            req.flash('error_msg', 'Ghi chú quá dài (tối đa 1000 ký tự).');
            return res.redirect(back);
        }

        const clientUser = await User.findOne({ _id: client, role: 'Client' }).select('branch name').lean();
        if (!clientUser) {
            req.flash('error_msg', 'Không tìm thấy khách hàng hợp lệ.');
            return res.redirect(back);
        }
        if (!clientUser.branch) {
            req.flash(
                'error_msg',
                'Khách hàng chưa có chi nhánh trên hồ sơ. Vui lòng cập nhật ở Quản lý khách hàng trước khi tạo hợp đồng (R4).'
            );
            return res.redirect(back);
        }
        if (branch && String(branch) !== String(clientUser.branch)) {
            req.flash(
                'error_msg',
                `Chi nhánh hợp đồng phải trùng với chi nhánh hồ sơ khách hàng (${clientUser.name}). Vui lòng cập nhật hồ sơ khách hoặc chọn đúng chi nhánh.`
            );
            return res.redirect(back);
        }

        // Determine mode: Template or Custom
        const serviceData = {
            clientId: client,
            branchId: branch,
            salesId: salesId,
            ptId: pt || null,
            discount: discountNum,
            couponCode: couponCode,
            startDate: new Date(),
            revenueSource: revenueSource || undefined
        };

        if (servicePackage) {
            // Template mode
            serviceData.packageId = servicePackage;
        } else if (customPkgName && customPkgDuration && customPkgPrice) {
            serviceData.customPackage = {
                name: customPkgName,
                type: customPkgType || 'Gym',
                durationMonths: Number(customPkgDuration),
                sessions: Number(customPkgSessions) || 0,
                price: Number(customPkgPrice)
            };
        } else {
            throw new Error('Vui lòng chọn gói tập có sẵn hoặc điền đầy đủ thông tin gói tuỳ chỉnh.');
        }

        // Use service to calculate money and dates
        const newContract = await contractService.createContract(serviceData);

        // Update payment info if provided
        if (paymentStatus) newContract.paymentStatus = paymentStatus;
        if (paymentMethods) {
            const normalized = Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods];
            newContract.paymentMethods = normalized;
            // Backward-compatible single field used by list.ejs
            if (normalized.length > 0) newContract.paymentMethod = normalized[0];
        }
        if (notes) newContract.notes = notes;
        
        if (paymentStatus === 'Paid') {
            newContract.paidAmount = newContract.totalAmount;
            newContract.contractStatus = 'Active';
            newContract.paidAt = new Date();
        } else if (paymentStatus === 'Deposit') {
            // Deposit = đã đặt cọc → cho phép bắt đầu lịch tập
            newContract.contractStatus = 'Active';
        }

        await newContract.save();

        const pkgDisplayName = newContract.packageSnapshot ? newContract.packageSnapshot.name : 'N/A';

        // NOTIFY CLIENT: New Contract Created
        await notificationService.pushNotification(
            client,
            'Hợp đồng mới đã được tạo',
            `Chào bạn, một hợp đồng mới (${newContract.contractCode}) đã được thiết lập cho gói tập "${pkgDisplayName}". Vui lòng kiểm tra.`,
            'Info',
            '/client/contracts'
        );

        // NOTIFY SALES: Sale contribution recognized
        await notificationService.pushNotification(
            salesId,
            'Ghi nhận doanh thu',
            `Bạn vừa chốt thành công 01 hợp đồng (${newContract.contractCode}). Chúc mừng!`,
            'Success'
        );

        req.flash('success_msg', 'Tạo hợp đồng thành công! Dòng tiền đã được ghi nhận.');
        
        // Dynamic redirect based on role
        if (req.user && req.user.role === 'PT') {
            return res.redirect('/pt');
        }
        res.redirect('/admin/contracts/list');
    } catch (err) {
        const redirectPath = req.originalUrl.startsWith('/pt') ? '/pt/contracts/create' : '/admin/contracts/create';
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message).join(', ');
            req.flash('error_msg', messages);
            return res.redirect(redirectPath);
        }
        req.flash('error_msg', err.message);
        return res.redirect(redirectPath);
    }
};

// 4. Form Chỉnh sửa Hợp đồng (Thường dùng để cập nhật Thanh toán)
exports.getEditForm = async (req, res, next) => {
    try {
        const contract = await Contract.findById(req.params.id);
        if (!contract) {
            return denyContractAccess(req, res, null);
        }
        if (!contractScope.canAccessContract(req.session.user, contract)) {
            return denyContractAccess(req, res, contract);
        }

        const clients = await User.find({ role: 'Client', status: 'Active' });
        const packages = await ServicePackage.find({ status: 'Active' });
        const branches = await Branch.find();
        const salesStaff = await User.find({
            role: { $in: ['Sales', 'Manager', 'Admin', 'SA', 'PT', 'Marketing', 'CEO', 'Accountant'] },
            status: 'Active'
        })
            .select('name _id role')
            .lean();
        const pts = await User.find({ role: 'PT', status: 'Active' });

        res.render('admin/contracts/form', {
            isEdit: true,
            contract,
            clients,
            packages,
            branches,
            salesStaff,
            pts,
            currentUserId: req.session.user ? String(req.session.user.id) : null
        });
    } catch (err) {
        next(err);
    }
};

// 5. Cập nhật Hợp đồng
exports.updateContract = async (req, res, next) => {
    try {
        const contractId = req.params.id;
        const existing = await Contract.findById(contractId);
        if (!existing) {
            return denyContractAccess(req, res, null);
        }
        if (!contractScope.canAccessContract(req.session.user, existing)) {
            return denyContractAccess(req, res, existing);
        }

        // ONLY update explicitly permitted fields for payment status changes
        const updateData = {};
        if (req.body.paymentStatus) {
            if (!PAYMENT_STATUS_ALLOWED.has(req.body.paymentStatus)) {
                req.flash('error_msg', 'Trạng thái bill không hợp lệ.');
                return res.redirect(`/admin/contracts/edit/${req.params.id}`);
            }
            updateData.paymentStatus = req.body.paymentStatus;
        }
        if (req.body.paymentMethods) {
            const normalized = Array.isArray(req.body.paymentMethods)
                ? req.body.paymentMethods
                : [req.body.paymentMethods];
            if (normalized.some((m) => !PAYMENT_METHODS_ALLOWED.has(m))) {
                req.flash('error_msg', 'Phương thức thanh toán không hợp lệ.');
                return res.redirect(`/admin/contracts/edit/${req.params.id}`);
            }
            updateData.paymentMethods = normalized;
            updateData.paymentMethod = normalized[0] || 'Cash';
        }
        if (req.body.notes !== undefined) {
            if (String(req.body.notes).length > 1000) {
                req.flash('error_msg', 'Ghi chú quá dài (tối đa 1000 ký tự).');
                return res.redirect(`/admin/contracts/edit/${req.params.id}`);
            }
            updateData.notes = req.body.notes;
        }
        
        // Handle payment status changes → activate contract
        if (updateData.paymentStatus === 'Paid') {
            const tempContract = await Contract.findById(contractId);
            updateData.paidAmount = tempContract.totalAmount;
            updateData.contractStatus = 'Active';
            updateData.paidAt = new Date();
        } else if (updateData.paymentStatus === 'Deposit') {
            updateData.contractStatus = 'Active';
        }

        const updated = await Contract.findByIdAndUpdate(contractId, updateData, { new: true });
        
        if (updated && updateData.paymentStatus === 'Paid') {
            await notificationService.pushNotification(
                updated.client,
                'Thanh toán thành công',
                `Hợp đồng ${updated.contractCode} đã được kích hoạt sau khi xác nhận thanh toán. Chúc bạn tập luyện hứng khởi!`,
                'Success',
                '/client/progress'
            );
            try {
                const affiliateService = require('../../programs/services/affiliateService');
                await affiliateService.processReferralRewardOnPaid(updated);
            } catch (e) {
                console.warn('[Affiliate] reward on contract update failed:', e.message);
            }
        }
        
        if (!updated) {
            req.flash('error_msg', 'Cập nhật thất bại. Không tìm thấy hợp đồng!');
            return res.redirect('/admin/contracts/list');
        }

        req.flash('success_msg', 'Cập nhật trạng thái Hợp đồng thành công!');
        res.redirect('/admin/contracts/list');
    } catch (err) {
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message).join(', ');
            req.flash('error_msg', messages);
            return res.redirect(`/admin/contracts/edit/${req.params.id}`);
        }
        next(err);
    }
};

// 6. Xóa Hợp đồng
exports.deleteContract = async (req, res, next) => {
    try {
        const contract = await Contract.findById(req.params.id);
        if (!contract) {
            return denyContractAccess(req, res, null);
        }
        if (!contractScope.canAccessContract(req.session.user, contract)) {
            return denyContractAccess(req, res, contract);
        }

        if (contract.paymentStatus === 'Paid' && req.session.user.role !== 'SA') {
            req.flash('error_msg', 'Chỉ có SuperAdmin mới được quyền xoá hợp đồng đã thu tiền!');
            return res.redirect('/admin/contracts/list');
        }

        await Contract.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Đã huỷ/xoá thủ công Hợp đồng thành công!');
        res.redirect('/admin/contracts/list');
    } catch (err) {
        next(err);
    }
};
// 7. Bảo lưu hợp đồng
exports.pauseContract = async (req, res, next) => {
    try {
        const contract = await Contract.findById(req.params.id);
        if (!contract) {
            return denyContractAccess(req, res, null);
        }
        if (!contractScope.canAccessContract(req.session.user, contract)) {
            return denyContractAccess(req, res, contract);
        }
        const { durationDays, reason } = req.body;
        await contractPauseService.pauseContract(req.params.id, parseInt(durationDays), reason);
        req.flash('success_msg', 'Bảo lưu hợp đồng thành công!');
        res.redirect('/admin/contracts/list');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/contracts/list');
    }
};

// 8. Kích hoạt lại hợp đồng
exports.unpauseContract = async (req, res, next) => {
    try {
        const contract = await Contract.findById(req.params.id);
        if (!contract) {
            return denyContractAccess(req, res, null);
        }
        if (!contractScope.canAccessContract(req.session.user, contract)) {
            return denyContractAccess(req, res, contract);
        }
        await contractPauseService.unpauseContract(req.params.id);
        req.flash('success_msg', 'Kích hoạt lại hợp đồng thành công!');
        res.redirect('/admin/contracts/list');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/contracts/list');
    }
};

/**
 * [Admin/CEO] Xem danh sách yêu cầu bảo lưu đang chờ
 */
const PauseRequest = require('../models/pauseRequestModel.js');
exports.getPauseRequests = async (req, res, next) => {
    try {
        const listFilter = contractScope.buildContractListFilter(req.session.user, {});
        const accessibleIds = await Contract.find(listFilter).distinct('_id');
        const requests = await PauseRequest.find({
            status: 'Pending',
            contract: { $in: accessibleIds }
        })
            .populate('client', 'name email avatar')
            .populate('contract', 'contractCode endDate branch sales pt')
            .sort({ createdAt: -1 });

        res.render('admin/contracts/pause-requests', { requests, activePage: 'contracts' });
    } catch (err) {
        next(err);
    }
};

/**
 * [Admin/CEO] Phê duyệt yêu cầu bảo lưu
 */
exports.approvePauseRequest = async (req, res, next) => {
    try {
        const requestId = req.params.id;
        const request = await PauseRequest.findById(requestId);
        if (!request) throw new Error('Yêu cầu không tồn tại');

        const contract = await Contract.findById(request.contract);
        if (!contract) {
            return denyContractAccess(req, res, null, '/admin/contracts/requests');
        }
        if (!contractScope.canAccessContract(req.session.user, contract)) {
            return denyContractAccess(req, res, contract, '/admin/contracts/requests');
        }

        // 1. Thực hiện bảo lưu hợp đồng qua service
        await contractPauseService.pauseContract(request.contract, request.durationDays, request.reason);

        // 2. Cập nhật trạng thái yêu cầu
        request.status = 'Approved';
        request.processedBy = req.session.user.id;
        request.adminNote = req.body.adminNote || 'Đã phê duyệt qua hệ thống';
        await request.save();

        // 3. Thông báo cho khách hàng
        await notificationService.pushNotification(
            request.client,
            'Bảo lưu đã được duyệt',
            `Yêu cầu bảo lưu ${request.durationDays} ngày của bạn đã được phê duyệt. Hợp đồng hiện đang tạm dừng.`,
            'Success',
            '/client/contracts'
        );

        req.flash('success_msg', 'Đã phê duyệt yêu cầu bảo lưu thành công!');
        res.redirect('/admin/contracts/requests');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/contracts/requests');
    }
};

/**
 * [Admin/CEO] Từ chối yêu cầu bảo lưu
 */
exports.rejectPauseRequest = async (req, res, next) => {
    try {
        const requestId = req.params.id;
        const request = await PauseRequest.findById(requestId);
        if (!request) throw new Error('Yêu cầu không tồn tại');

        const contract = await Contract.findById(request.contract);
        if (!contract) {
            return denyContractAccess(req, res, null, '/admin/contracts/requests');
        }
        if (!contractScope.canAccessContract(req.session.user, contract)) {
            return denyContractAccess(req, res, contract, '/admin/contracts/requests');
        }

        request.status = 'Rejected';
        request.processedBy = req.session.user.id;
        request.adminNote = req.body.adminNote || 'Không đủ điều kiện bảo lưu';
        await request.save();

        // Thông báo
        await notificationService.pushNotification(
            request.client,
            'Yêu cầu bảo lưu bị từ chối',
            `Yêu cầu bảo lưu của bạn không được phê duyệt. Lý do: ${request.adminNote}`,
            'Warning',
            '/client/contracts'
        );

        req.flash('success_msg', 'Đã từ chối yêu cầu bảo lưu.');
        res.redirect('/admin/contracts/requests');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/contracts/requests');
    }
};

/**
 * 9. Chi tiết Hợp đồng (kèm lịch sử thanh toán)
 */
exports.getDetail = async (req, res, next) => {
    try {
        const contract = await Contract.findById(req.params.id)
            .populate('client', 'name email phone avatar cccdHash')
            .populate('pt', 'name email phone avatar')
            .populate('sales', 'name')
            .populate('branch', 'name address')
            .populate('servicePackage', 'name price description durationInMonths maxSessions')
            .lean();

        if (!contract) {
            req.flash('error_msg', 'Không tìm thấy hợp đồng!');
            return res.redirect('/admin/contracts/list');
        }

        if (!contractScope.canAccessContract(req.session.user, contract)) {
            return denyContractAccess(req, res, contract);
        }

        // .lean() bypasses Mongoose getters so encrypted fields come back raw — decrypt manually
        const decryptField = (val) => { try { return val ? decrypt(val) : val; } catch { return val; } };
        if (contract.client) {
            contract.client.phone = decryptField(contract.client.phone);
            contract.client.email = decryptField(contract.client.email);
        }
        if (contract.pt) {
            contract.pt.phone = decryptField(contract.pt.phone);
            contract.pt.email = decryptField(contract.pt.email);
        }

        // Lấy lịch sử thanh toán
        const paymentService = require('../services/paymentService');
        const paymentHistory = await paymentService.getPaymentHistory(req.params.id);

        res.render('admin/contracts/detail', { contract, paymentHistory });
    } catch (err) {
        next(err);
    }
};

