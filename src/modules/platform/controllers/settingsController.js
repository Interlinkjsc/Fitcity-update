const systemSettingsService = require('../services/systemSettingsService.js');

exports.getSettingsPage = async (req, res, next) => {
    try {
        const settings = await systemSettingsService.getGlobalSettings();
        res.render('admin/settings/index', { settings });
    } catch (err) {
        next(err);
    }
};

exports.updateSettings = async (req, res, next) => {
    try {
        const { defaultVat, defaultPtCommissionRate, ptPayrollMode, timesheetRatePerShift } = req.body;
        await systemSettingsService.updateGlobalSettings({
            defaultVat,
            defaultPtCommissionRate,
            ptPayrollMode,
            timesheetRatePerShift,
            updatedBy: req.session.user.id
        });
        req.flash('success_msg', 'Đã cập nhật cài đặt hệ thống (VAT & hoa hồng PT mặc định).');
        res.redirect('/admin/settings');
    } catch (err) {
        next(err);
    }
};
