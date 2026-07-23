const crypto = require('crypto');

function base64urlEncode(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64urlDecodeToString(input) {
    const padLen = (4 - (input.length % 4)) % 4;
    const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
    return Buffer.from(padded, 'base64').toString('utf8');
}

function hmacSha256Base64url(secret, data) {
    return crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function getSecret() {
    const secret = process.env.QR_HMAC_SECRET;
    if (secret) return secret;

    if (process.env.NODE_ENV === 'production') {
        const err = new Error('Thiếu QR_HMAC_SECRET trong môi trường.');
        err.statusCode = 500;
        throw err;
    }

    // Non-production fallback to keep local/dev/test flows usable.
    return 'dev-only-qr-hmac-secret-change-in-production';
}

/**
 * Create a short-lived signed token for QR.
 * Token format: base64url(payloadJson) + '.' + base64url(hmac(payloadB64url))
 */
function signQrToken({ sid, act, cid, pid, ttlSeconds = 60 }) {
    if (!sid || !act || !cid || !pid) {
        const err = new Error('Thiếu dữ liệu để tạo QR token.');
        err.statusCode = 400;
        throw err;
    }
    if (!['start', 'end'].includes(act)) {
        const err = new Error('Action QR không hợp lệ.');
        err.statusCode = 400;
        throw err;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
        sid: String(sid),
        act,
        cid: String(cid),
        pid: String(pid),
        exp: nowSec + Number(ttlSeconds || 60)
    };

    const payloadJson = JSON.stringify(payload);
    const payloadB64 = base64urlEncode(payloadJson);
    const sig = hmacSha256Base64url(getSecret(), payloadB64);
    return `${payloadB64}.${sig}`;
}

/**
 * Verify QR token signature + exp and return payload.
 * Throws Error with statusCode 400 on invalid tokens.
 */
function verifyQrToken(token) {
    try {
        if (!token || typeof token !== 'string' || !token.includes('.')) {
            const err = new Error('QR token không hợp lệ.');
            err.statusCode = 400;
            throw err;
        }
        const [payloadB64, sig] = token.split('.');
        if (!payloadB64 || !sig) {
            const err = new Error('QR token không hợp lệ.');
            err.statusCode = 400;
            throw err;
        }

        const expectedSig = hmacSha256Base64url(getSecret(), payloadB64);
        const sigOk = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
        if (!sigOk) {
            const err = new Error('QR token sai chữ ký.');
            err.statusCode = 400;
            throw err;
        }

        const payloadStr = base64urlDecodeToString(payloadB64);
        const payload = JSON.parse(payloadStr);

        const nowSec = Math.floor(Date.now() / 1000);
        if (!payload || !payload.exp || nowSec > Number(payload.exp)) {
            const err = new Error('QR đã hết hạn.');
            err.statusCode = 400;
            throw err;
        }
        if (!payload.sid || !payload.act || !payload.cid || !payload.pid) {
            const err = new Error('QR token thiếu dữ liệu.');
            err.statusCode = 400;
            throw err;
        }
        if (!['start', 'end'].includes(payload.act)) {
            const err = new Error('Action QR không hợp lệ.');
            err.statusCode = 400;
            throw err;
        }
        return payload;
    } catch (e) {
        if (e && e.statusCode) throw e;
        const err = new Error('QR token không hợp lệ.');
        err.statusCode = 400;
        throw err;
    }
}

module.exports = { signQrToken, verifyQrToken };

