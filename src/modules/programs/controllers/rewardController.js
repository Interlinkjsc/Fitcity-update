const rewardService = require('../services/rewardService');
const User = require('../../users/models/userModel.js');

exports.getRewardList = async (req, res) => {
    try {
        const filters = {};
        if (req.query.status) filters.status = req.query.status;
        if (req.query.type) filters.type = req.query.type;
        if (req.query.clientId) filters.clientId = req.query.clientId;

        const rewards = await rewardService.getAllRewards(filters);
        res.render('admin/rewards/list', { 
            title: 'Quản lý Voucher & Reward',
            rewards,
            filters: req.query
        });
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin');
    }
};

exports.getCreateForm = async (req, res) => {
    try {
        const clients = await User.find({ role: 'Client' }).select('name email');
        res.render('admin/rewards/form', {
            title: 'Gán Reward cho khách',
            clients,
            reward: null
        });
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/rewards');
    }
};

exports.storeReward = async (req, res) => {
    try {
        const { clientId, type, title, description, value, expiresAt, couponId, notes } = req.body;
        
        await rewardService.assignReward({
            clientId,
            type,
            title,
            description,
            value: Number(value) || 0,
            expiresAt,
            couponId: couponId || null,
            notes,
            assignedBy: req.session.user._id
        });

        req.flash('success_msg', 'Đã gán Reward thành công! Khách hàng đã nhận được thông báo.');
        res.redirect('/admin/rewards');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/rewards/create');
    }
};

exports.getDetail = async (req, res) => {
    try {
        const Reward = require('../models/rewardModel.js');
        const reward = await Reward.findById(req.params.id)
            .populate('client', 'name email phone')
            .populate('coupon', 'code type value')
            .populate('assignedBy', 'name');
        
        if (!reward) {
            req.flash('error_msg', 'Reward không tồn tại');
            return res.redirect('/admin/rewards');
        }

        res.render('admin/rewards/detail', { title: 'Chi tiết Reward', reward });
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/rewards');
    }
};

exports.deleteReward = async (req, res) => {
    try {
        const Reward = require('../models/rewardModel.js');
        await Reward.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Đã xóa Reward');
        res.redirect('/admin/rewards');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/rewards');
    }
};

