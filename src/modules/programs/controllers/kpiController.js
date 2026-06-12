const KPIConfig = require('../models/kpiModel.js');
const Branch = require('../../crm/models/branchModel.js');

exports.getKPIList = async (req, res, next) => {
    try {
        const branches = await Branch.find();
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        const kpis = await KPIConfig.find().populate('branch').sort({ year: -1, month: -1 });

        res.render('admin/kpi/list', {
            kpis,
            branches,
            currentFilter: { month: currentMonth, year: currentYear },
            activePage: 'kpi'
        });
    } catch (err) {
        next(err);
    }
};

exports.saveKPI = async (req, res, next) => {
    try {
        const { branch, month, year, revenueTarget, newLeadTarget, contractTarget, notes } = req.body;

        await KPIConfig.findOneAndUpdate(
            { branch, month, year },
            {
                revenueTarget: Number(revenueTarget),
                newLeadTarget: Number(newLeadTarget) || 0,
                contractTarget: Number(contractTarget) || 0,
                notes,
                createdBy: req.session.user.id
            },
            { upsert: true, new: true, runValidators: true }
        );

        req.flash('success_msg', 'Đã cập nhật chỉ tiêu KPI thành công!');
        res.redirect('/admin/kpi');
    } catch (err) {
        req.flash('error_msg', 'Lỗi thiết lập KPI: ' + err.message);
        res.redirect('/admin/kpi');
    }
};

