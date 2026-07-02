const WebSetting = require('../models/webSettingModel');
const WebSlotImage = require('../models/webSlotImageModel');
const WebBranch = require('../models/webBranchModel');

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
        // Ảnh theo vị trí (slot) — khách upload để thay ảnh website, không cần rebuild
        const slotImages = await WebSlotImage.find().sort({ slotId: 1 }).lean();
        const branches = await WebBranch.find({ published: true }).sort({ sort: 1 }).select('slug name').lean();
        const KNOWN_SLOTS = [
            { id: 'home-featured', label: 'Trang chủ — ảnh nổi bật' },
            { id: 'home-pose-before', label: 'Trang chủ — tư thế TRƯỚC' },
            { id: 'home-pose-after', label: 'Trang chủ — tư thế SAU' },
            ...[1, 2, 3, 4, 5, 6].map(i => ({ id: `hero-${i}`, label: `Trang chủ — hero collage ô ${i}` })),
            ...branches.flatMap(b => ([
                { id: `branch-${b.slug}-hero`, label: `CN ${b.name} — ảnh bìa` },
                { id: `branch-${b.slug}-g1`, label: `CN ${b.name} — gallery 1` },
                { id: `branch-${b.slug}-g2`, label: `CN ${b.name} — gallery 2` },
                { id: `branch-${b.slug}-g3`, label: `CN ${b.name} — gallery 3` },
            ]))
        ];
        res.render('admin/website/settings', { settings, slotImages, knownSlots: KNOWN_SLOTS, activePage: 'website-settings' });
    } catch (err) { next(err); }
};

// POST /admin/website/settings/slot-images — upload ảnh cho 1 slot
exports.uploadSlotImage = async (req, res, next) => {
    try {
        const slotId = (req.body.slotId || '').trim();
        if (!slotId) {
            req.flash('error_msg', 'Thiếu vị trí ảnh (slot).');
            return res.redirect('/admin/website/settings');
        }
        if (!req.slotUpload) {
            req.flash('error_msg', 'Chưa chọn file ảnh hợp lệ.');
            return res.redirect('/admin/website/settings');
        }
        await WebSlotImage.findOneAndUpdate(
            { slotId },
            { slotId, mediaKey: req.slotUpload.key },
            { upsert: true, new: true }
        );
        req.flash('success_msg', `Đã cập nhật ảnh cho vị trí "${slotId}". Website sẽ hiển thị ảnh mới ngay.`);
        res.redirect('/admin/website/settings');
    } catch (err) { next(err); }
};

// POST /admin/website/settings/slot-images/delete — gỡ ảnh slot (về ảnh mặc định)
exports.deleteSlotImage = async (req, res, next) => {
    try {
        const slotId = (req.body.slotId || '').trim();
        await WebSlotImage.deleteOne({ slotId });
        req.flash('success_msg', `Đã gỡ ảnh vị trí "${slotId}" — website dùng lại ảnh mặc định.`);
        res.redirect('/admin/website/settings');
    } catch (err) { next(err); }
};

// GET /api/web/slot-images — public map { slotId: mediaKey }
exports.apiGetSlotImages = async (req, res, next) => {
    try {
        const rows = await WebSlotImage.find().lean();
        const map = {};
        rows.forEach(r => { map[r.slotId] = r.mediaKey; });
        res.json(map);
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
