const WebSetting = require('../models/webSettingModel');
const zaloService = require('../../platform/services/zaloService');
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
            { id: 'logo', label: 'Logo website (header)' },
            { id: 'logo-dark', label: 'Logo footer (nền tối)' },
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
        const zaloRows = await WebSetting.find({ key: { $in: ['zalo_access_token', 'zalo_refresh_token', 'zalo_app_id', 'zalo_token_expires_at'] } }).lean();
        const zaloMap = {};
        zaloRows.forEach(r => { zaloMap[r.key] = r.value; });
        const zaloStatus = {
            hasToken: !!(zaloMap.zalo_access_token || process.env.ZALO_OA_ACCESS_TOKEN),
            hasRefresh: !!zaloMap.zalo_refresh_token,
            hasAppCreds: !!zaloMap.zalo_app_id || !!process.env.ZALO_APP_ID,
            expiresAt: Number(zaloMap.zalo_token_expires_at || 0),
            templateCheckin: process.env.ZALO_ZNS_TEMPLATE_CHECKIN || '',
            templateCheckout: process.env.ZALO_ZNS_TEMPLATE_CHECKOUT || ''
        };
        res.render('admin/website/settings', { settings, slotImages, knownSlots: KNOWN_SLOTS, zaloStatus, activePage: 'website-settings' });
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
        // Bug 6/7 #24: upload logo qua slot 'logo'/'logo-dark' → tự cập nhật setting tương ứng
        if (slotId === 'logo' || slotId === 'logo-dark') {
            const settingKey = slotId === 'logo' ? 'logo_key' : 'logo_dark_key';
            await WebSetting.findOneAndUpdate(
                { key: settingKey },
                { key: settingKey, value: req.slotUpload.key },
                { upsert: true }
            );
        }
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

// POST /admin/website/settings/zalo — lưu token/app creds Zalo ZNS (admin dán từ UI)
exports.updateZaloSettings = async (req, res, next) => {
    try {
        const { zaloAccessToken, zaloRefreshToken, zaloAppId, zaloAppSecret } = req.body;
        if (!zaloAccessToken && !zaloRefreshToken && !zaloAppId && !zaloAppSecret) {
            req.flash('error_msg', 'Chưa nhập thông tin Zalo nào.');
            return res.redirect('/admin/website/settings');
        }
        await zaloService.saveManualTokens({
            accessToken: (zaloAccessToken || '').trim(),
            refreshToken: (zaloRefreshToken || '').trim(),
            appId: (zaloAppId || '').trim(),
            appSecret: (zaloAppSecret || '').trim()
        });
        req.flash('success_msg', 'Đã lưu cấu hình Zalo ZNS. Bấm "Kiểm tra kết nối" để xác nhận token.');
        res.redirect('/admin/website/settings');
    } catch (err) { next(err); }
};

// POST /admin/website/settings/zalo/test — kiểm tra token + cấu trúc template (JSON)
exports.testZaloConnection = async (req, res) => {
    const result = await zaloService.checkZnsConnection();
    res.json(result);
};

// GET /admin/website/settings/zalo/connect — chuyển tới Zalo xin quyền OA (OAuth PKCE)
exports.zaloConnect = async (req, res, next) => {
    try {
        const { verifier, challenge } = zaloService.makePkce();
        req.session.zaloCodeVerifier = verifier;
        const proto = req.headers['x-forwarded-proto'] || req.protocol;
        const redirectUri = `${proto}://${req.headers.host}/admin/website/settings/zalo/callback`;
        const url = await zaloService.buildPermissionUrl(redirectUri, challenge, 'fitcity');
        res.redirect(url);
    } catch (err) { next(err); }
};

// GET /admin/website/settings/zalo/callback — Zalo trả code về, đổi lấy token
exports.zaloCallback = async (req, res) => {
    try {
        const code = req.query.code;
        const verifier = req.session.zaloCodeVerifier;
        if (!code || !verifier) {
            req.flash('error_msg', 'Thiếu code hoặc phiên hết hạn. Bấm "Kết nối Zalo OA" lại.');
            return res.redirect('/admin/website/settings');
        }
        await zaloService.exchangeCodeForToken(code, verifier);
        delete req.session.zaloCodeVerifier;
        req.flash('success_msg', 'Kết nối Zalo OA thành công! Token đã lưu và sẽ tự động gia hạn.');
        res.redirect('/admin/website/settings');
    } catch (err) {
        req.flash('error_msg', 'Kết nối Zalo thất bại: ' + err.message);
        res.redirect('/admin/website/settings');
    }
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
