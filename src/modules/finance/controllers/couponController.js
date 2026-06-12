const Coupon = require('../models/couponModel.js');
const User = require('../../users/models/userModel.js');
const Reward = require('../../programs/models/rewardModel.js');
const { getPagination } = require('../../../utils/paginationHelper');

exports.assignReward = async (req, res, next) => {
    try {
        const { couponId, clientId, notes } = req.body;

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            req.flash('error_msg', 'Không tìm thấy mã giảm giá!');
            return res.redirect('/admin/coupons');
        }

        const client = await User.findById(clientId);
        if (!client || client.role !== 'Client') {
            req.flash('error_msg', 'Khách hàng không hợp lệ!');
            return res.redirect('/admin/coupons');
        }

        const isFreeSessions = coupon.type === 'FreeSessions';
        await Reward.create({
            client: clientId,
            coupon: couponId,
            type: isFreeSessions ? 'FreeSession' : 'Voucher',
            title: isFreeSessions
                ? `Tặng ${coupon.value} buổi tập — ${coupon.code}`
                : `Voucher Giảm giá: ${coupon.code}`,
            description: isFreeSessions
                ? `Voucher tặng ${coupon.value} buổi tập do quản trị cấp.`
                : 'Mã giảm giá cá nhân được tặng từ quản trị viên.',
            value: coupon.value,
            expiresAt: coupon.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            assignedBy: req.session.user.id,
            notes
        });

        req.flash('success_msg', `Đã tặng voucher ${coupon.code} cho khách hàng ${client.name} thành công!`);
        res.redirect('/admin/coupons');
    } catch (err) {
        req.flash('error_msg', 'Có lỗi xảy ra: ' + err.message);
        res.redirect('/admin/coupons');
    }
};

exports.getCouponList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const totalDocs = await Coupon.countDocuments();
        const coupons = await Coupon.find()
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const pagination = getPagination(totalDocs, page, limit);

        const clients = await User.find({ role: 'Client' })
            .select('name phone _id')
            .lean();

        res.render('admin/coupons/list', { 
            coupons,
            clients,
            pagination,
            query: req.query,
            activePage: 'coupons'
        });
    } catch (err) {
        next(err);
    }
};

exports.getCreateForm = async (req, res, next) => {
    res.render('admin/coupons/form', { 
        isEdit: false,
        coupon: new Coupon(),
        activePage: 'coupons'
    });
};

exports.storeCoupon = async (req, res, next) => {
    try {
        const { code, type, value, maxDiscount, endDate, usageLimit } = req.body;

        let numValue = Number(value);
        if (type === 'FreeSessions') {
            numValue = Math.max(1, Math.min(500, Math.floor(numValue)));
        }

        await Coupon.create({
            code: code.toUpperCase(),
            type,
            value: numValue,
            maxDiscount: Number(maxDiscount) || 0,
            endDate,
            usageLimit: Number(usageLimit) || 100,
            createdBy: req.session.user.id
        });

        req.flash('success_msg', 'Tạo mã giảm giá thành công!');
        res.redirect('/admin/coupons');
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/coupons/create');
    }
};

exports.getEditForm = async (req, res, next) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            req.flash('error_msg', 'Không tìm thấy mã giảm giá!');
            return res.redirect('/admin/coupons');
        }
        res.render('admin/coupons/form', { 
            isEdit: true,
            coupon,
            activePage: 'coupons'
        });
    } catch (err) {
        next(err);
    }
};

exports.updateCoupon = async (req, res, next) => {
    try {
        const updates = { ...req.body };

        const existing = await Coupon.findById(req.params.id);
        if (!existing) {
            throw new Error('Không tìm thấy mã giảm giá!');
        }

        const mergedType = updates.type !== undefined ? updates.type : existing.type;

        if (updates.value !== undefined) {
            const v = Number(updates.value);
            updates.value =
                mergedType === 'FreeSessions'
                    ? Math.max(1, Math.min(500, Math.floor(v)))
                    : v;
        }
        if (updates.maxDiscount !== undefined) updates.maxDiscount = Number(updates.maxDiscount) || 0;
        if (updates.usageLimit !== undefined) updates.usageLimit = Number(updates.usageLimit) || 100;

        if (updates.startDate === '') updates.startDate = undefined;
        if (updates.endDate === '') updates.endDate = undefined;

        const updatedCoupon = await Coupon.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedCoupon) {
            throw new Error('Không tìm thấy mã giảm giá!');
        }

        if (req.method === 'PATCH' || req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
            return res.status(200).json({ status: 'success', data: updatedCoupon });
        }

        req.flash('success_msg', 'Đã cập nhật mã giảm giá thành công!');
        res.redirect('/admin/coupons');
    } catch (err) {
        if (req.method === 'PATCH' || req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
            return res.status(400).json({ status: 'fail', message: err.message });
        }
        req.flash('error_msg', err.message);
        res.redirect('back');
    }
};

exports.deleteCoupon = async (req, res, next) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Đã xoá mã giảm giá thành công!');
        res.redirect('/admin/coupons');
    } catch (err) {
        next(err);
    }
};

exports.getDetail = async (req, res, next) => {
    try {
        const coupon = await Coupon.findById(req.params.id)
            .populate('createdBy', 'name email role');
            
        if (!coupon) {
            req.flash('error_msg', 'Không tìm thấy mã giảm giá!');
            return res.redirect('/admin/coupons');
        }

        res.render('admin/coupons/detail', { 
            coupon, 
            activePage: 'coupons' 
        });
    } catch (err) {
        next(err);
    }
};

