const Branch = require('../models/branchModel.js');
const User = require('../../users/models/userModel.js');
const { getPagination } = require('../../../utils/paginationHelper');

exports.getBranchList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalDocs = await Branch.countDocuments();
        const branches = await Branch.find()
            .populate('manager', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const pagination = getPagination(totalDocs, page, limit);

        res.render('admin/branches/list', { 
            branches,
            pagination,
            query: req.query
        });
    } catch (err) {
        next(err);
    }
};

exports.getCreateForm = async (req, res, next) => {
    try {
        const managers = await User.find({ role: 'Manager', status: 'Active' });
        res.render('admin/branches/form', { 
            isEdit: false, 
            branch: new Branch(),
            managers 
        });
    } catch (err) {
        next(err);
    }
};

exports.storeBranch = async (req, res, next) => {
    try {
        const { name } = req.body;
        
        const existing = await Branch.findOne({ name });
        if (existing) {
            req.flash('error_msg', 'Tên chi nhánh đã tồn tại!');
            return res.redirect('/admin/branches/create');
        }

        await Branch.create(req.body);
        req.flash('success_msg', 'Tạo chi nhánh mới thành công!');
        res.redirect('/admin/branches/list');
    } catch (err) {
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message).join(', ');
            req.flash('error_msg', messages);
            return res.redirect('/admin/branches/create');
        }
        next(err);
    }
};

exports.getEditForm = async (req, res, next) => {
    try {
        const branch = await Branch.findById(req.params.id);
        if (!branch) {
            req.flash('error_msg', 'Không tìm thấy chi nhánh này!');
            return res.redirect('/admin/branches/list');
        }
        const managers = await User.find({ role: 'Manager', status: 'Active' });
        res.render('admin/branches/form', { isEdit: true, branch, managers });
    } catch (err) {
        next(err);
    }
};

exports.updateBranch = async (req, res, next) => {
    try {
        const { name } = req.body;
        const branchId = req.params.id;

        const existing = await Branch.findOne({ name, _id: { $ne: branchId } });
        if (existing) {
            req.flash('error_msg', 'Tên chi nhánh bị trùng lặp với cơ sở khác!');
            return res.redirect(`/admin/branches/edit/${branchId}`);
        }

        const updated = await Branch.findByIdAndUpdate(
            branchId, 
            req.body, 
            { new: true, runValidators: true }
        );
        
        if (!updated) {
            req.flash('error_msg', 'Cập nhật thất bại. Không tìm thấy chi nhánh!');
            return res.redirect('/admin/branches/list');
        }

        req.flash('success_msg', 'Cập nhật thông tin chi nhánh thành công!');
        res.redirect('/admin/branches/list');
    } catch (err) {
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message).join(', ');
            req.flash('error_msg', messages);
            return res.redirect(`/admin/branches/edit/${req.params.id}`);
        }
        next(err);
    }
};

exports.deleteBranch = async (req, res, next) => {
    try {
        const hasStaffs = await User.findOne({ branch: req.params.id, status: 'Active' });
        if (hasStaffs) {
            req.flash('error_msg', 'Không thể xóa chi nhánh có nhân sự đang hoạt động. Vui lòng thuyên chuyển hoặc vô hiệu hóa nhân sự trước!');
            return res.redirect('/admin/branches/list');
        }

        const deleted = await Branch.findByIdAndDelete(req.params.id);
        if (!deleted) {
            req.flash('error_msg', 'Không tìm thấy chi nhánh!');
        } else {
            req.flash('success_msg', 'Xóa chi nhánh thành công!');
        }
        res.redirect('/admin/branches/list');
    } catch (err) {
        next(err);
    }
};

exports.getDetail = async (req, res, next) => {
    try {
        const branch = await Branch.findById(req.params.id).populate('manager', 'name email phone avatar');
        if (!branch) {
            req.flash('error_msg', 'Không tìm thấy chi nhánh!');
            return res.redirect('/admin/branches/list');
        }

        const staffCount = await User.countDocuments({ branch: branch._id, role: { $in: ['PT', 'Sales', 'Manager'] } });
        const ptCount = await User.countDocuments({ branch: branch._id, role: 'PT' });
        const salesCount = await User.countDocuments({ branch: branch._id, role: 'Sales' });

        const Contract = require('../../contracts/models/contractModel.js');
        const activeContractsCount = await Contract.countDocuments({ branch: branch._id, contractStatus: 'Active' });

        res.render('admin/branches/detail', { 
            branch, 
            staffCount, 
            ptCount, 
            salesCount, 
            activeContractsCount,
            activePage: 'branches' 
        });
    } catch (err) {
        next(err);
    }
};

