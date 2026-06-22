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

/**
 * Internal: POST JSON to Zalo ZNS API.
 * Never throws — logs and returns null on any error.
 */
function postZns(body) {
    return new Promise((resolve) => {
        const token = process.env.ZALO_OA_ACCESS_TOKEN;
        if (!token) {
            console.warn('[ZaloZNS] ZALO_OA_ACCESS_TOKEN not set — skipping ZNS');
            return resolve(null);
        }

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
