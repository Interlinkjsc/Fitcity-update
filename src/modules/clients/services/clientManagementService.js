const mongoose = require('mongoose');
const User = require('../../users/models/userModel.js');
const Branch = require('../../crm/models/branchModel.js');
const Contract = require('../../contracts/models/contractModel.js');
const WorkoutSession = require('../../programs/models/workoutSessionModel.js');
const BodyMetric = require('../../programs/models/bodyMetricModel.js');
const MealPlan = require('../../programs/models/mealPlanModel.js');
const { getPagination } = require('../../../utils/paginationHelper');
const { hash } = require('../../../utils/encryption');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS_ALLOWED = new Set(['Active', 'Suspended', 'Resigned']);

class ClientServiceError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'ClientServiceError';
        this.code = code;
    }
}

function sanitizeClientPayload(payload = {}) {
    const out = { ...payload };
    if (typeof out.name === 'string') out.name = out.name.trim();
    if (typeof out.email === 'string') out.email = out.email.trim().toLowerCase();
    if (typeof out.phone === 'string') out.phone = out.phone.trim();
    if (typeof out.address === 'string') out.address = out.address.trim();
    return out;
}

function validateCreatePayload(payload) {
    if (!payload.name || payload.name.length < 2) {
        throw new ClientServiceError('Họ tên khách hàng phải có ít nhất 2 ký tự.', 'INVALID_NAME');
    }
    if (!payload.email || !EMAIL_REGEX.test(payload.email)) {
        throw new ClientServiceError('Email khách hàng không hợp lệ.', 'INVALID_EMAIL');
    }
    if (!payload.password || String(payload.password).length < 6) {
        throw new ClientServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 'INVALID_PASSWORD');
    }
    if (payload.status && !STATUS_ALLOWED.has(payload.status)) {
        throw new ClientServiceError('Trạng thái tài khoản không hợp lệ.', 'INVALID_STATUS');
    }
}

const buildClientFilters = (keyword) => {
    const filters = { role: 'Client' };
    if (!keyword) return filters;

    filters.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { emailHash: hash(keyword) },
        { phoneHash: hash(keyword) }
    ];
    return filters;
};

exports.getClientList = async (query = {}, requestingUser = null) => {
    const page = parseInt(query.page, 10) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const keyword = (query.keyword || '').trim();
    const filters = buildClientFilters(keyword);

    // Manager chỉ xem client trong chi nhánh mình quản lý
    if (requestingUser?.role === 'Manager' && requestingUser?.branch) {
        filters.branch = requestingUser.branch;
    } else if (query.branchId && query.branchId !== 'all') {
        filters.branch = query.branchId;
    }

    const totalDocs = await User.countDocuments(filters);
    const clients = await User.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    return {
        clients,
        pagination: getPagination(totalDocs, page, limit),
        query
    };
};

exports.getCreateFormData = () => ({
    isEdit: false,
    clientData: new User()
});

exports.createClient = async (payload) => {
    const data = sanitizeClientPayload(payload);
    validateCreatePayload(data);

    const email = data?.email;
    const existing = await User.findOne({ emailHash: hash(email) });
    if (existing) {
        throw new ClientServiceError('Email này đã được sử dụng!', 'DUPLICATE_EMAIL');
    }

    const branchId = data?.branch;
    if (!branchId || !mongoose.Types.ObjectId.isValid(String(branchId))) {
        throw new ClientServiceError('Vui lòng chọn chi nhánh cho khách hàng.', 'MISSING_BRANCH');
    }
    const branchOk = await Branch.exists({ _id: branchId, status: { $ne: 'Closed' } });
    if (!branchOk) {
        throw new ClientServiceError('Chi nhánh không hợp lệ hoặc đã đóng.', 'INVALID_BRANCH');
    }

    const { branch, ...rest } = data;
    return User.create({
        ...rest,
        branch: branchId,
        role: 'Client'
    });
};

exports.getClientById = async (clientId) => {
    const clientData = await User.findOne({ _id: clientId, role: 'Client' });
    if (!clientData) {
        throw new ClientServiceError('Không tìm thấy khách hàng này!', 'CLIENT_NOT_FOUND');
    }
    return clientData;
};

exports.getEditFormData = async (clientId) => {
    const clientData = await exports.getClientById(clientId);
    return {
        isEdit: true,
        clientData
    };
};

exports.updateClient = async (clientId, payload) => {
    const updateData = sanitizeClientPayload(payload);
    if (!updateData.password || updateData.password.trim() === '') {
        delete updateData.password;
    }
    if (updateData.name !== undefined && updateData.name.length < 2) {
        throw new ClientServiceError('Họ tên khách hàng phải có ít nhất 2 ký tự.', 'INVALID_NAME');
    }
    if (updateData.email !== undefined && !EMAIL_REGEX.test(updateData.email)) {
        throw new ClientServiceError('Email cập nhật không hợp lệ.', 'INVALID_EMAIL');
    }
    if (updateData.password !== undefined && String(updateData.password).length < 6) {
        throw new ClientServiceError('Mật khẩu phải có ít nhất 6 ký tự.', 'INVALID_PASSWORD');
    }
    if (updateData.status !== undefined && !STATUS_ALLOWED.has(updateData.status)) {
        throw new ClientServiceError('Trạng thái tài khoản không hợp lệ.', 'INVALID_STATUS');
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'branch')) {
        const branchId = updateData.branch;
        if (!branchId || String(branchId).trim() === '') {
            throw new ClientServiceError('Khách hàng phải được gán chi nhánh.', 'MISSING_BRANCH');
        }
        if (!mongoose.Types.ObjectId.isValid(String(branchId))) {
            throw new ClientServiceError('Chi nhánh không hợp lệ.', 'INVALID_BRANCH');
        }
        const branchOk = await Branch.exists({ _id: branchId, status: { $ne: 'Closed' } });
        if (!branchOk) {
            throw new ClientServiceError('Chi nhánh không hợp lệ hoặc đã đóng.', 'INVALID_BRANCH');
        }
    }

    if (updateData.email) {
        const existing = await User.findOne({
            emailHash: hash(updateData.email),
            _id: { $ne: clientId }
        });
        if (existing) {
            throw new ClientServiceError('Email cập nhật bị trùng lặp với người khác!', 'DUPLICATE_EMAIL');
        }
    }

    const clientData = await exports.getClientById(clientId);
    Object.keys(updateData).forEach((key) => {
        clientData[key] = updateData[key];
    });
    clientData.role = 'Client';

    await clientData.save({ runValidators: true });
    return clientData;
};

/**
 * Xóa cứng tài khoản khách hàng (chỉ khi không còn hợp đồng — tránh mất liên kết tài chính).
 */
exports.deleteClient = async (clientId) => {
    await exports.getClientById(clientId);

    const hasContracts = await Contract.exists({ client: clientId });
    if (hasContracts) {
        throw new ClientServiceError(
            'Không thể xóa khách hàng đang có hợp đồng trong hệ thống. Vui lòng xử lý hoặc huỷ các hợp đồng liên quan trước.',
            'HAS_CONTRACTS'
        );
    }

    const deleted = await User.findOneAndDelete({ _id: clientId, role: 'Client' });
    if (!deleted) {
        throw new ClientServiceError('Không tìm thấy khách hàng này!', 'CLIENT_NOT_FOUND');
    }
    return deleted;
};

exports.getClientDetailData = async (clientId) => {
    const clientData = await exports.getClientById(clientId);
    const cid = clientData._id;

    const contracts = await Contract.find({ client: cid })
        .populate('servicePackage', 'name')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();

    const now = new Date();

    const [
        totalContracts,
        activeContracts,
        completedSessions,
        cancelledSessions,
        noShowSessions,
        upcomingSessions,
        sessionHistory,
        bodyMetrics,
        mealPlans
    ] = await Promise.all([
        Contract.countDocuments({ client: cid }),
        Contract.countDocuments({ client: cid, contractStatus: 'Active' }),
        WorkoutSession.countDocuments({ client: cid, status: 'Completed' }),
        WorkoutSession.countDocuments({ client: cid, status: 'Cancelled' }),
        WorkoutSession.countDocuments({ client: cid, status: 'No_Show' }),
        WorkoutSession.find({
            client: cid,
            status: 'Scheduled',
            scheduledTime: { $gte: now }
        })
            .populate('pt', 'name email avatar')
            .populate('branch', 'name')
            .populate('contract', 'contractCode contractStatus')
            .sort({ scheduledTime: 1 })
            .limit(25)
            .lean(),
        WorkoutSession.find({
            client: cid,
            $or: [
                { status: { $in: ['Completed', 'Cancelled', 'No_Show', 'In_Progress'] } },
                { status: 'Scheduled', scheduledTime: { $lt: now } }
            ]
        })
            .populate('pt', 'name email avatar')
            .populate('branch', 'name')
            .populate('contract', 'contractCode contractStatus')
            .sort({ scheduledTime: -1 })
            .limit(40)
            .lean(),
        BodyMetric.find({ client: cid })
            .populate('pt', 'name')
            .sort({ date: -1 })
            .limit(15)
            .lean(),
        MealPlan.find({ client: cid })
            .populate('pt', 'name')
            .sort({ active: -1, updatedAt: -1 })
            .limit(8)
            .lean()
    ]);

    const latestMetric = bodyMetrics[0] || null;
    const oldestMetric = bodyMetrics.length > 1 ? bodyMetrics[bodyMetrics.length - 1] : null;

    return {
        clientData,
        contracts,
        stats: {
            totalContracts,
            activeContracts,
            completedSessions,
            cancelledSessions,
            noShowSessions,
            upcomingCount: upcomingSessions.length
        },
        upcomingSessions,
        sessionHistory,
        bodyMetrics,
        mealPlans,
        progressInsight: {
            latestMetric,
            oldestMetric,
            metricCount: bodyMetrics.length
        }
    };
};

exports.ClientServiceError = ClientServiceError;

