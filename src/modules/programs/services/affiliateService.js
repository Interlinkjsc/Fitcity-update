const User = require('../../users/models/userModel');
const AffiliateRewardLog = require('../models/affiliateRewardLogModel');
const rewardService = require('./rewardService');

const REFERRAL_REWARD_VALUE = 200000;
const REFERRAL_REWARD_DAYS = 90;

async function getSystemAssignerId() {
    const admin = await User.findOne({ role: { $in: ['Admin', 'SA'] }, status: 'Active' }).select('_id');
    return admin ? admin._id : null;
}

exports.getReferralDashboard = async (clientId) => {
    const me = await User.findById(clientId).select('name referralCode referredBy');
    if (!me) return null;

    const f1Users = await User.find({ referredBy: clientId, role: 'Client' })
        .select('name createdAt status')
        .sort({ createdAt: -1 })
        .lean();

    const f1Ids = f1Users.map((u) => u._id);
    const f2Users =
        f1Ids.length > 0
            ? await User.find({ referredBy: { $in: f1Ids }, role: 'Client' })
                  .select('name createdAt referredBy')
                  .populate('referredBy', 'name')
                  .sort({ createdAt: -1 })
                  .limit(50)
                  .lean()
            : [];

    const rewardLogs = await AffiliateRewardLog.find({ referrer: clientId })
        .populate('referredUser', 'name')
        .populate('contract', 'contractCode')
        .sort({ createdAt: -1 })
        .limit(20);

    return {
        referralCode: me.referralCode,
        f1Users,
        f2Users,
        f2Count: f2Users.length,
        rewardLogs
    };
};

/**
 * Khi F1 có HĐ Paid → thưởng referrer (coupon/points qua Reward type Gift).
 */
exports.processReferralRewardOnPaid = async (contract) => {
    if (!contract || contract.paymentStatus !== 'Paid') return null;

    const existing = await AffiliateRewardLog.findOne({ contract: contract._id });
    if (existing) return existing;

    const referred = await User.findById(contract.client).select('name referredBy');
    if (!referred || !referred.referredBy) return null;

    const assignerId = await getSystemAssignerId();
    if (!assignerId) return null;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFERRAL_REWARD_DAYS);

    const reward = await rewardService.assignReward({
        clientId: referred.referredBy,
        type: 'Gift',
        title: 'Thưởng giới thiệu F1',
        description: `${referred.name} đã thanh toán HĐ ${contract.contractCode || ''}`.trim(),
        value: REFERRAL_REWARD_VALUE,
        expiresAt,
        assignedBy: assignerId,
        notes: 'Affiliate F1 auto-reward'
    });

    return AffiliateRewardLog.create({
        referrer: referred.referredBy,
        referredUser: referred._id,
        contract: contract._id,
        reward: reward._id,
        level: 'F1'
    });
};

exports.resolveReferrerByCode = async (code) => {
    if (!code || typeof code !== 'string') return null;
    return User.findOne({
        referralCode: code.trim().toUpperCase(),
        role: 'Client',
        status: 'Active'
    }).select('_id referralCode name');
};
