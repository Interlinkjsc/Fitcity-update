const WebSetting = require('../models/webSettingModel');

const SETTING_KEYS = [
    'logo_key', 'logo_dark_key',
    'brand_forest', 'brand_orange',
    'hotline', 'email', 'facebook',
    'footer_tagline', 'home_hero_heading'
];

async function getAll() {
    const rows = await WebSetting.find({ key: { $in: SETTING_KEYS } }).lean();
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    return map;
}

// GET /api/web/settings — public, no auth
exports.apiGetSettings = async (req, res, next) => {
    try {
        const settings = await getAll();
        res.json(settings);
    } catch (err) { next(err); }
};

// GET /admin/website/settings
exports.getAdminSettingsPage = async (req, res, next) => {
    try {
        const settings = await getAll();
        res.render('admin/website/settings', { settings, activePage: 'website-settings' });
    } catch (err) { next(err); }
};

// POST /admin/website/settings
exports.updateAdminSettings = async (req, res, next) => {
    try {
        const updates = {};
        SETTING_KEYS.forEach(k => {
            if (req.body[k] !== undefined) updates[k] = req.body[k];
        });

        await Promise.all(
            Object.entries(updates).map(([key, value]) =>
                WebSetting.findOneAndUpdate({ key }, { key, value }, { upsert: true, new: true })
            )
        );

        req.flash('success_msg', 'Đã cập nhật cài đặt website.');
        res.redirect('/admin/website/settings');
    } catch (err) { next(err); }
};
