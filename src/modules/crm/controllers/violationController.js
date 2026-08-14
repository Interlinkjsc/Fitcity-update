const Violation = require('../models/violationModel.js');
const User = require('../../users/models/userModel.js');
const { getPagination } = require('../../../utils/paginationHelper');

exports.getViolations = async (req, res, next) => {
    try {
        const { month, year, staffId, status, search, page: pageQuery } = req.query;
        const page = parseInt(pageQuery) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        const filter = {};
        
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            filter.date = { $gte: startDate, $lte: endDate };
        } else if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            filter.date = { $gte: startDate, $lte: endDate };
        }

        if (staffId) filter.staff = staffId;
        if (status && status !== 'all') filter.status = status;

        if (search) {
            const users = await User.find({ name: { $regex: search, $options: 'i' } }).select('_id');
            const userIds = users.map(u => u._id);
            filter.staff = { $in: userIds };
        }

        const totalDocs = await Violation.countDocuments(filter);
        const violations = await Violation.find(filter)
            .populate('staff', 'name email role avatar')
            .populate('loggedBy', 'name')
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);

        const pagination = getPagination(totalDocs, page, limit);

        const typeStats = await Violation.aggregate([
            { $match: filter },
            { $group: { _id: '$type', count: { $sum: 1 }, totalPenalty: { $sum: '$penaltyAmount' } } },
            { $sort: { count: -1 } }
        ]);

        const staffStats = await Violation.aggregate([
            { $match: filter },
            { $group: { _id: '$staff', count: { $sum: 1 }, totalPenalty: { $sum: '$penaltyAmount' } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staffInfo' } },
            { $unwind: '$staffInfo' }
        ]);

        const allStaff = await User.find({ role: { $nin: ['Client'] }, status: 'Active' })
            .select('name role')
            .sort({ name: 1 });

        const totalPenaltyResult = await Violation.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$penaltyAmount' } } }
        ]);
        const totalPenalty = totalPenaltyResult.length > 0 ? totalPenaltyResult[0].total : 0;

        res.render('admin/violations/list', {
            violations,
            typeStats,
            staffStats,
            allStaff,
            pagination,
            totalPenalty,
            query: req.query,
            filters: {
                month: month || '',
                year: year || new Date().getFullYear(),
                staffId: staffId || '',
                status: status || 'all',
                search: search || ''
            },
            activePage: 'violations'
        });
    } catch (error) {
        next(error);
    }
};

exports.getCreateViolation = async (req, res, next) => {
    try {
        const staff = await User.find({ role: { $nin: ['Client'] }, status: 'Active' })
            .select('name email role');
            
        res.render('admin/violations/form', {
            isEdit: false,
            staff,
            activePage: 'violations'
        });
    } catch (error) {
        next(error);
    }
};

exports.createViolation = async (req, res, next) => {
    try {
        const { staff, type, description, penaltyAmount, date } = req.body;
        
        await Violation.create({
            staff,
            type,
            description,
            penaltyAmount,
            date: date || Date.now(),
            loggedBy: req.session.user.id
        });

        req.flash('success_msg', 'Đã ghi nhận vi phạm thành công');
        res.redirect('/admin/violations');
    } catch (error) {
        req.flash('error_msg', error.message);
        res.redirect('/admin/violations/create');
    }
};

exports.getEditViolation = async (req, res, next) => {
    try {
        // Bug 23/7 A2: populate staff → form giữ đúng nhân sự đã chọn, không bắt gõ lại tên.
        const violation = await Violation.findById(req.params.id)
            .populate('staff', 'name email role')
            .lean();
        if (!violation) {
            req.flash('error_msg', 'Không tìm thấy thông tin vi phạm');
            return res.redirect('/admin/violations');
        }

        if (violation.status === 'Applied_To_Payroll') {
            req.flash('error_msg', 'Không thể sửa vi phạm đã được tính vào lương');
            return res.redirect('/admin/violations');
        }

        // Form dùng violation.staffInfo để hiển thị + violation.staff (id) cho hidden input.
        violation.staffInfo = violation.staff && typeof violation.staff === 'object' ? violation.staff : null;
        violation.staff = violation.staff && violation.staff._id ? String(violation.staff._id) : String(violation.staff || '');

        const staff = await User.find({ role: { $nin: ['Client'] }, status: 'Active' })
            .select('name email role');

        res.render('admin/violations/form', {
            isEdit: true,
            violation,
            staff,
            activePage: 'violations'
        });
    } catch (error) {
        next(error);
    }
};

exports.updateViolation = async (req, res, next) => {
    try {
        const violation = await Violation.findById(req.params.id);
        if (!violation) {
            req.flash('error_msg', 'Không tìm thấy vi phạm');
            return res.redirect('/admin/violations');
        }

        if (violation.status === 'Applied_To_Payroll') {
            req.flash('error_msg', 'Không thể sửa vi phạm đã được tính vào lương');
            return res.redirect('/admin/violations');
        }

        const { staff, type, description, penaltyAmount, date, status } = req.body;

        // Rp27/7 A8: staff rỗng/không hợp lệ (hidden input bị clear khi chỉ đổi trạng thái)
        // → giữ nguyên nhân sự cũ thay vì crash Cast to ObjectId.
        if (staff && require('mongoose').Types.ObjectId.isValid(staff)) {
            violation.staff = staff;
        }
        violation.type = type;
        violation.description = description;
        violation.penaltyAmount = penaltyAmount;
        if (date) violation.date = date;
        if (status) violation.status = status;

        await violation.save();

        req.flash('success_msg', 'Đã cập nhật thông tin vi phạm');
        res.redirect('/admin/violations');
    } catch (error) {
        req.flash('error_msg', error.message);
        res.redirect(`/admin/violations/edit/${req.params.id}`);
    }
};

exports.deleteViolation = async (req, res, next) => {
    try {
        const violation = await Violation.findById(req.params.id);
        if (!violation) {
            req.flash('error_msg', 'Không tìm thấy vi phạm');
            return res.redirect('/admin/violations');
        }

        if (violation.status === 'Applied_To_Payroll') {
            req.flash('error_msg', 'Không thể xóa vi phạm đã được tính vào lương');
            return res.redirect('/admin/violations');
        }

        await violation.deleteOne();
        req.flash('success_msg', 'Đã xóa vi phạm thành công');
        res.redirect('/admin/violations');
    } catch (error) {
        next(error);
    }
};

