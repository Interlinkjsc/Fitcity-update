const Reward = require('../models/rewardModel.js');
const Coupon = require('../../finance/models/couponModel.js');
const notificationService = require('../../platform/services/notificationService');

exports.assignReward = async ({ clientId, type, title, description, value, expiresAt, couponId, notes, assignedBy }) => {
    let appliedCoupon = null;
    if (couponId) {
        const coupon = await Coupon.findById(couponId);
        if (!coupon) throw new Error('Coupon không tồn tại');
        if (!coupon.active) throw new Error('Coupon đã bị vô hiệu hóa');
        appliedCoupon = coupon._id;
    }

    const reward = await Reward.create({
        client: clientId,
        type,
        title,
        description,
        value: value || 0,
        expiresAt: new Date(expiresAt),
        coupon: appliedCoupon,
        notes,
        assignedBy,
        status: 'Active'
    });

    await notificationService.pushNotification(
        clientId,
        '🎁 Bạn nhận được phần thưởng!',
        `${title} - ${description || 'Quà tặng từ FitCity'}. Giá trị: ${value ? value.toLocaleString('vi-VN') + 'đ' : 'Đặc biệt'}`,
        'Success',
        '/client/rewards',
        assignedBy
    );

    return reward;
};

exports.getClientRewards = async (clientId) => {
    return Reward.find({ client: clientId })
        .populate('coupon', 'code type value')
        .populate('assignedBy', 'name')
        .sort({ createdAt: -1 });
};

exports.getAllRewards = async (filters = {}) => {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    if (filters.clientId) query.client = filters.clientId;

    return Reward.find(query)
        .populate('client', 'name email')
        .populate('coupon', 'code type value')
        .populate('assignedBy', 'name')
        .sort({ createdAt: -1 });
};

exports.useReward = async (rewardId, clientId) => {
    const reward = await Reward.findOne({ _id: rewardId, client: clientId });
    if (!reward) throw new Error('Phần thưởng không tồn tại');
    if (reward.status !== 'Active') throw new Error('Phần thưởng không khả dụng');
    if (reward.expiresAt < new Date()) {
        reward.status = 'Expired';
        await reward.save();
        throw new Error('Phần thưởng đã hết hạn');
    }

    reward.status = 'Used';
    reward.usedAt = new Date();
    await reward.save();
    return reward;
};

