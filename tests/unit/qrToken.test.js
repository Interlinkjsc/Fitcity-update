const { signQrToken, verifyQrToken } = require('../../src/utils/qrToken');

describe('qrToken utils', () => {
    beforeAll(() => {
        process.env.QR_HMAC_SECRET = 'test_qr_secret_123';
    });

    it('should sign and verify token', () => {
        const token = signQrToken({
            sid: 's1',
            act: 'start',
            cid: 'c1',
            pid: 'p1',
            ttlSeconds: 60
        });
        const payload = verifyQrToken(token);
        expect(payload.sid).toBe('s1');
        expect(payload.act).toBe('start');
        expect(payload.cid).toBe('c1');
        expect(payload.pid).toBe('p1');
        expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('should reject expired token', () => {
        const token = signQrToken({
            sid: 's2',
            act: 'end',
            cid: 'c2',
            pid: 'p2',
            ttlSeconds: -1
        });
        expect(() => verifyQrToken(token)).toThrow('QR đã hết hạn.');
    });
});

