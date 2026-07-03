const https = require('https');

/**
 * Format Vietnamese phone number to Zalo ZNS format: "84xxxxxxxxx"
 * Strips leading 0, prepends country code 84.
 */
exports.formatPhone = (rawPhone) => {
    if (!rawPhone || typeof rawPhone !== 'string') return null;
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('84') && digits.length === 11) return digits;
    if (digits.startsWith('0') && digits.length === 10) return '84' + digits.slice(1);
    if (digits.length === 9) return '84' + digits;
    return null;
};

// ── Token management ─────────────────────────────────────────────────────────
// Access token OA hết hạn sau ~25h. Nếu có ZALO_APP_ID + ZALO_APP_SECRET và
// refresh token (env ZALO_REFRESH_TOKEN lần đầu, sau đó lưu xoay vòng trong
// Mongo qua WebSetting), service tự refresh — không phải thay token mỗi ngày.
// Refresh token của Zalo dùng-một-lần: mỗi lần refresh trả refresh token MỚI,
// bắt buộc persist lại ngay.

const TOKEN_KEYS = {
    access: 'zalo_access_token',
    refresh: 'zalo_refresh_token',
    expiresAt: 'zalo_token_expires_at'
};
let tokenCache = { access: null, expiresAt: 0 };

function getWebSetting() {
    // Lazy require — tránh vòng lặp require và cho test mock dễ
    return require('../../website/models/webSettingModel');
}

async function readStoredToken() {
    try {
        // Chưa kết nối Mongo (boot sớm / unit test) → fallback env, không treo query
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            return { access: null, refresh: null, expiresAt: 0 };
        }
        const WebSetting = getWebSetting();
        const rows = await WebSetting.find({ key: { $in: Object.values(TOKEN_KEYS) } }).lean();
        const map = {};
        rows.forEach(r => { map[r.key] = r.value; });
        return {
            access: map[TOKEN_KEYS.access] || null,
            refresh: map[TOKEN_KEYS.refresh] || null,
            expiresAt: Number(map[TOKEN_KEYS.expiresAt] || 0)
        };
    } catch (_) {
        return { access: null, refresh: null, expiresAt: 0 };
    }
}

async function persistToken({ access, refresh, expiresAt }) {
    try {
        const WebSetting = getWebSetting();
        const entries = [
            [TOKEN_KEYS.access, access],
            [TOKEN_KEYS.refresh, refresh],
            [TOKEN_KEYS.expiresAt, String(expiresAt)]
        ];
        await Promise.all(entries.map(([key, value]) =>
            WebSetting.findOneAndUpdate({ key }, { key, value: value || '' }, { upsert: true })
        ));
    } catch (e) {
        console.error('[ZaloZNS] persistToken error:', e.message);
    }
}

/** POST x-www-form-urlencoded tới oauth.zaloapp.com để refresh access token. */
function requestTokenRefresh(refreshToken, appId, appSecret) {
    return new Promise((resolve) => {
        const payload = new URLSearchParams({
            refresh_token: refreshToken,
            app_id: appId,
            grant_type: 'refresh_token'
        }).toString();
        const req = https.request({
            hostname: 'oauth.zaloapp.com',
            path: '/v4/oa/access_token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'secret_key': appSecret,
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (_) { resolve(null); }
            });
        });
        req.on('error', (err) => {
            console.error('[ZaloZNS] refresh request error:', err.message);
            resolve(null);
        });
        req.write(payload);
        req.end();
    });
}

/**
 * Lấy access token còn hạn: cache → DB → refresh (nếu có app creds).
 * Fallback cuối: env ZALO_OA_ACCESS_TOKEN tĩnh.
 */
async function getAccessToken() {
    const now = Date.now();
    if (tokenCache.access && tokenCache.expiresAt - now > 5 * 60 * 1000) {
        return tokenCache.access;
    }

    const stored = await readStoredToken();
    if (stored.access && stored.expiresAt - now > 5 * 60 * 1000) {
        tokenCache = { access: stored.access, expiresAt: stored.expiresAt };
        return stored.access;
    }

    const appId = process.env.ZALO_APP_ID;
    const appSecret = process.env.ZALO_APP_SECRET;
    const refreshToken = stored.refresh || process.env.ZALO_REFRESH_TOKEN;
    if (appId && appSecret && refreshToken) {
        const resp = await requestTokenRefresh(refreshToken, appId, appSecret);
        if (resp && resp.access_token) {
            const expiresAt = now + (Number(resp.expires_in) || 90000) * 1000;
            tokenCache = { access: resp.access_token, expiresAt };
            await persistToken({
                access: resp.access_token,
                refresh: resp.refresh_token || refreshToken,
                expiresAt
            });
            console.log('[ZaloZNS] Access token refreshed OK');
            return resp.access_token;
        }
        console.error('[ZaloZNS] Token refresh failed:', resp && (resp.error_name || resp.error));
    }

    return process.env.ZALO_OA_ACCESS_TOKEN || null;
}
exports.getAccessToken = getAccessToken;

/**
 * Internal: POST JSON to Zalo ZNS API.
 * Never throws — logs and returns null on any error.
 */
async function postZns(body) {
    const token = await getAccessToken();
    if (!token) {
        console.warn('[ZaloZNS] Không có access token (env/DB/refresh) — bỏ qua ZNS');
        return null;
    }
    return new Promise((resolve) => {
        const payload = JSON.stringify(body);
        const options = {
            hostname: 'business.openapi.zalo.me',
            path: '/message/template',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': token,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error !== 0) {
                        console.error('[ZaloZNS] API error:', parsed.error, parsed.message);
                    }
                    resolve(parsed);
                } catch (_) {
                    console.error('[ZaloZNS] Invalid JSON response:', data);
                    resolve(null);
                }
            });
        });

        req.on('error', (err) => {
            console.error('[ZaloZNS] Request error:', err.message);
            resolve(null);
        });

        req.write(payload);
        req.end();
    });
}

/**
 * Send check-in notification via Zalo ZNS.
 * Never throws — errors are swallowed so main flow is never blocked.
 */
exports.sendZnsCheckin = async (phone, clientName, ptName, sessionTime, branchName) => {
    try {
        const formattedPhone = exports.formatPhone(phone);
        if (!formattedPhone) {
            console.warn('[ZaloZNS] sendZnsCheckin: invalid phone:', phone);
            return null;
        }

        const templateId = process.env.ZALO_ZNS_TEMPLATE_CHECKIN;
        if (!templateId) {
            console.warn('[ZaloZNS] ZALO_ZNS_TEMPLATE_CHECKIN not set — skipping');
            return null;
        }

        const timeStr = sessionTime instanceof Date
            ? sessionTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
            : String(sessionTime);

        return await postZns({
            phone: formattedPhone,
            template_id: templateId,
            template_data: {
                client_name: clientName || '',
                pt_name: ptName || '',
                session_time: timeStr,
                branch_name: branchName || ''
            },
            tracking_id: `checkin_${Date.now()}`
        });
    } catch (e) {
        console.error('[ZaloZNS] sendZnsCheckin error:', e.message);
        return null;
    }
};

/**
 * Send check-out notification via Zalo ZNS.
 * Never throws — errors are swallowed so main flow is never blocked.
 */
exports.sendZnsCheckout = async (phone, clientName, ptName, startTime, endTime) => {
    try {
        const formattedPhone = exports.formatPhone(phone);
        if (!formattedPhone) {
            console.warn('[ZaloZNS] sendZnsCheckout: invalid phone:', phone);
            return null;
        }

        const templateId = process.env.ZALO_ZNS_TEMPLATE_CHECKOUT;
        if (!templateId) {
            console.warn('[ZaloZNS] ZALO_ZNS_TEMPLATE_CHECKOUT not set — skipping');
            return null;
        }

        const fmt = (d) => d instanceof Date
            ? d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
            : String(d || '');

        const startStr = fmt(startTime);
        const endStr = fmt(endTime);

        let durationStr = '';
        if (startTime instanceof Date && endTime instanceof Date) {
            const mins = Math.round((endTime - startTime) / 60000);
            durationStr = mins > 0 ? `${mins} phút` : '';
        }

        return await postZns({
            phone: formattedPhone,
            template_id: templateId,
            template_data: {
                client_name: clientName || '',
                pt_name: ptName || '',
                start_time: startStr,
                end_time: endStr,
                duration: durationStr
            },
            tracking_id: `checkout_${Date.now()}`
        });
    } catch (e) {
        console.error('[ZaloZNS] sendZnsCheckout error:', e.message);
        return null;
    }
};
