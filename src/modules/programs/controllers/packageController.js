const ServicePackage = require('../models/servicePackageModel.js');
const { getPagination } = require('../../../utils/paginationHelper');

exports.getPackageList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalDocs = await ServicePackage.countDocuments();
        const packages = await ServicePackage.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const pagination = getPagination(totalDocs, page, limit);

        res.render('admin/packages/list', { 
            packages,
            pagination,
            query: req.query
        });
    } catch (err) {
        next(err);
    }
};

exports.getCreateForm = (req, res) => {
    res.render('admin/packages/form', { 
        isEdit: false, 
        pkg: new ServicePackage() 
    });
};

exports.storePackage = async (req, res, next) => {
    try {
        const payload = { ...req.body };
        if (payload.durationMonths) payload.durationMonths = Number(payload.durationMonths);
        await ServicePackage.create(payload);
        req.flash('success_msg', 'Tạo gói tập mới thành công!');
        res.redirect('/admin/packages/list');
    } catch (err) {
        if (err && err.code === 11000) {
            req.flash('error_msg', 'Tên gói tập đã tồn tại — vui lòng đặt tên khác.');
            return res.redirect('/admin/packages/create');
        }
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message).join(', ');
            req.flash('error_msg', messages);
            return res.redirect('/admin/packages/create');
        }
        next(err);
    }
};

exports.getEditForm = async (req, res, next) => {
    try {
        const pkg = await ServicePackage.findById(req.params.id);
        if (!pkg) {
            req.flash('error_msg', 'Không tìm thấy gói tập này!');
            return res.redirect('/admin/packages/list');
        }
        res.render('admin/packages/form', { isEdit: true, pkg });
    } catch (err) {
        next(err);
    }
};

exports.updatePackage = async (req, res, next) => {
    try {
        const updated = await ServicePackage.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!updated) {
            req.flash('error_msg', 'Chỉnh sửa thất bại! Không tìm thấy gói tập.');
            return res.redirect('/admin/packages/list');
        }
        req.flash('success_msg', 'Cập nhật gói tập thành công!');
        res.redirect('/admin/packages/list');
    } catch (err) {
        if (err && err.code === 11000) {
            req.flash('error_msg', 'Tên gói tập đã tồn tại — vui lòng đặt tên khác.');
            return res.redirect('/admin/packages');
        }
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message).join(', ');
            req.flash('error_msg', messages);
            return res.redirect(`/admin/packages/edit/${req.params.id}`);
        }
        next(err);
    }
};

exports.deletePackage = async (req, res, next) => {
    try {
        const deleted = await ServicePackage.findByIdAndDelete(req.params.id);
        if (!deleted) {
            req.flash('error_msg', 'Không tìm thấy gói tập để xoá!');
        } else {
            req.flash('success_msg', 'Xoá gói tập thành công!');
        }
        res.redirect('/admin/packages/list');
    } catch (err) {
        next(err);
    }
};

exports.getDetail = async (req, res, next) => {
    try {
        const pkg = await ServicePackage.findById(req.params.id).lean();
        if (!pkg) {
            req.flash('error_msg', 'Không tìm thấy gói tập!');
            return res.redirect('/admin/packages/list');
        }
        
        const Contract = require('../../contracts/models/contractModel.js');
        const activeContractsCount = await Contract.countDocuments({ 
            servicePackage: pkg._id,
            contractStatus: 'Active'
        });
        const totalContractsCount = await Contract.countDocuments({ 
            servicePackage: pkg._id
        });

        const revenueAgg = await Contract.aggregate([
            { $match: { servicePackage: pkg._id } },
            { $group: { _id: null, total: { $sum: '$basePrice' } } }
        ]);
        const totalRevenueFromContracts = revenueAgg[0]?.total || 0;
        
        res.render('admin/packages/detail', { 
            pkg, 
            activeContractsCount,
            totalContractsCount,
            totalRevenueFromContracts,
            activePage: 'packages' 
        });
    } catch (err) {
        next(err);
    }
};

