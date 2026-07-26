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
    expiresAt: 'zalo_token_expires_at',
    appId: 'zalo_app_id',
    appSecret: 'zalo_app_secret'
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
            expiresAt: Number(map[TOKEN_KEYS.expiresAt] || 0),
            appId: map[TOKEN_KEYS.appId] || null,
            appSecret: map[TOKEN_KEYS.appSecret] || null
        };
    } catch (_) {
        return { access: null, refresh: null, expiresAt: 0, appId: null, appSecret: null };
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

    const appId = stored.appId || process.env.ZALO_APP_ID;
    const appSecret = stored.appSecret || process.env.ZALO_APP_SECRET;
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

/** Cắt chuỗi theo maxLength của template (tránh Zalo từ chối -114). */
function truncate(v, max) {
    const str = (v == null ? '' : String(v)).trim();
    return str.length > max ? str.slice(0, max) : (str || ' ');
}

/** Param DATE của ZNS: "HH:mm dd/MM/yyyy" (≤20 ký tự), múi giờ VN. */
function formatZnsDate(d) {
    const date = d instanceof Date ? d : new Date(d || Date.now());
    const parts = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false
    }).formatToParts(date);
    const get = (t) => (parts.find(x => x.type === t) || {}).value || '';
    return `${get('hour')}:${get('minute')} ${get('day')}/${get('month')}/${get('year')}`;
}

exports.sendZnsCheckin = async (phone, clientName, ptName, sessionTime, branchLabel, bookingCode) => {
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

        // Template 601710 "Thông báo CHECK IN" — params thật của mẫu đã duyệt:
        // customer_name, booking_code, schedule_time (DATE "HH:mm dd/MM/yyyy"), address, name
        return await postZns({
            phone: formattedPhone,
            template_id: templateId,
            template_data: {
                customer_name: truncate(clientName, 30),
                booking_code: truncate(bookingCode || 'FITCITY', 30),
                schedule_time: formatZnsDate(sessionTime),
                address: truncate(branchLabel || 'FITCITY', 200),
                name: truncate(ptName, 30)
            },
            tracking_id: `checkin_${Date.now()}`
        });
    } catch (e) {
        console.error('[ZaloZNS] sendZnsCheckin error:', e.message);
        return null;
    }
};

exports.sendZnsCheckout = async (phone, clientName, ptName, endTime, branchLabel, bookingCode) => {
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

        // Template 601713 "Thông báo CHECKOUT buổi tập" — cùng bộ params với check-in
        return await postZns({
            phone: formattedPhone,
            template_id: templateId,
            template_data: {
                customer_name: truncate(clientName, 30),
                booking_code: truncate(bookingCode || 'FITCITY', 30),
                schedule_time: formatZnsDate(endTime),
                address: truncate(branchLabel || 'FITCITY', 200),
                name: truncate(ptName, 30)
            },
            tracking_id: `checkout_${Date.now()}`
        });
    } catch (e) {
        console.error('[ZaloZNS] sendZnsCheckout error:', e.message);
        return null;
    }
};

// ── Self-serve helpers (dùng bởi trang admin Cài đặt Website) ────────────────

/** Admin dán token thủ công từ UI — lưu DB, coi như còn hạn 24h. */
exports.saveManualTokens = async ({ accessToken, refreshToken, appId, appSecret }) => {
    const stored = await readStoredToken();
    const expiresAt = accessToken ? Date.now() + 24 * 3600 * 1000 : stored.expiresAt;
    await persistToken({
        access: accessToken || stored.access,
        refresh: refreshToken || stored.refresh,
        expiresAt
    });
    try {
        const WebSetting = getWebSetting();
        const extra = [];
        if (appId !== undefined && appId !== '') extra.push([TOKEN_KEYS.appId, appId]);
        if (appSecret !== undefined && appSecret !== '') extra.push([TOKEN_KEYS.appSecret, appSecret]);
        await Promise.all(extra.map(([key, value]) =>
            WebSetting.findOneAndUpdate({ key }, { key, value }, { upsert: true })
        ));
    } catch (e) {
        console.error('[ZaloZNS] save app creds error:', e.message);
    }
    if (accessToken) tokenCache = { access: accessToken, expiresAt };
};

/** GET JSON từ Zalo với access_token header. Không throw. */
function getZaloJson(hostname, path, token) {
    return new Promise((resolve) => {
        const req = https.request({ hostname, path, method: 'GET', headers: { access_token: token } }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (_) { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.end();
    });
}

/** Kiểm tra token hiện tại với ZNS + lấy cấu trúc template. */
exports.checkZnsConnection = async () => {
    const token = await getAccessToken();
    if (!token) return { ok: false, reason: 'Chưa có access token (dán vào ô bên trên rồi Lưu).' };

    const quota = await getZaloJson('business.openapi.zalo.me', '/message/quota', token);
    if (!quota || quota.error !== 0) {
        return {
            ok: false,
            reason: `Zalo từ chối token (error ${quota ? quota.error : 'network'}: ${quota ? quota.message : 'không gọi được API'}). Kiểm tra: phải là token CỦA OA (Official Account), không phải token đăng nhập cá nhân.`
        };
    }

    const templates = {};
    for (const [label, envKey] of [['checkin', 'ZALO_ZNS_TEMPLATE_CHECKIN'], ['checkout', 'ZALO_ZNS_TEMPLATE_CHECKOUT']]) {
        const tid = process.env[envKey];
        if (!tid) { templates[label] = { error: `${envKey} chưa cấu hình` }; continue; }
        const info = await getZaloJson('business.openapi.zalo.me', `/template/info/v2?template_id=${tid}`, token);
        if (info && info.error === 0 && info.data) {
            templates[label] = {
                id: tid,
                name: info.data.templateName,
                status: info.data.status,
                params: (info.data.listParams || []).map(p => p.name)
            };
        } else {
            templates[label] = { id: tid, error: info ? `${info.error}: ${info.message}` : 'network' };
        }
    }
    return { ok: true, quota: quota.data, templates };
};

// ── OAuth connect flow (v4, PKCE) — lấy access+refresh token khớp đúng app ──────
const crypto = require('crypto');

function base64urlFromBuffer(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Tạo code_verifier + code_challenge (S256) cho PKCE. */
exports.makePkce = () => {
    const verifier = base64urlFromBuffer(crypto.randomBytes(32));
    const challenge = base64urlFromBuffer(crypto.createHash('sha256').update(verifier).digest());
    return { verifier, challenge };
};

/** URL xin quyền OA (admin OA bấm để cấp quyền). */
exports.buildPermissionUrl = async (redirectUri, codeChallenge, state) => {
    const stored = await readStoredToken();
    const appId = stored.appId || process.env.ZALO_APP_ID;
    const params = new URLSearchParams({
        app_id: appId || '',
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        state: state || 'fitcity'
    });
    return `https://oauth.zaloapp.com/v4/oa/permission?${params.toString()}`;
};

/** Đổi authorization code → access+refresh token, lưu lại. */
exports.exchangeCodeForToken = async (code, codeVerifier) => {
    const stored = await readStoredToken();
    const appId = stored.appId || process.env.ZALO_APP_ID;
    const appSecret = stored.appSecret || process.env.ZALO_APP_SECRET;
    if (!appId || !appSecret) throw new Error('Chưa cấu hình App ID / Secret key.');

    const payload = new URLSearchParams({
        code,
        app_id: appId,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
    }).toString();

    const resp = await new Promise((resolve) => {
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
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (_) { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.write(payload);
        req.end();
    });

    if (!resp || !resp.access_token) {
        throw new Error('Zalo từ chối: ' + (resp ? (resp.error_description || resp.error_name || resp.error) : 'không gọi được API'));
    }
    const expiresAt = Date.now() + (Number(resp.expires_in) || 90000) * 1000;
    tokenCache = { access: resp.access_token, expiresAt };
    await persistToken({
        access: resp.access_token,
        refresh: resp.refresh_token || stored.refresh,
        expiresAt
    });
    return { ok: true };
};
