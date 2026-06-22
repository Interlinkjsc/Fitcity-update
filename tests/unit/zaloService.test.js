/**
 * Unit tests for src/modules/platform/services/zaloService.js
 * All HTTP calls are mocked — no real network requests.
 */

// ── Mock https BEFORE requiring the module under test ──────────────────────
const mockWrite = jest.fn();
const mockEnd = jest.fn();
const mockOn = jest.fn();

const mockReq = {
    write: mockWrite,
    end: mockEnd,
    on: mockOn
};

let capturedOptions = null;
let capturedCallback = null;

jest.mock('https', () => ({
    request: jest.fn((options, callback) => {
        capturedOptions = options;
        capturedCallback = callback;
        return mockReq;
    })
}));

const https = require('https');
const zaloService = require('../../src/modules/platform/services/zaloService');

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Simulate a successful ZNS API response.
 */
function simulateSuccess(body = JSON.stringify({ error: 0, message: 'Success', data: {} })) {
    if (!capturedCallback) throw new Error('https.request was not called');
    const mockRes = {
        _listeners: {},
        on(event, fn) { this._listeners[event] = fn; return this; }
    };
    capturedCallback(mockRes);
    mockRes._listeners['data'] && mockRes._listeners['data'](body);
    mockRes._listeners['end'] && mockRes._listeners['end']();
}

/**
 * Simulate a network error on the request.
 */
function simulateNetworkError(message = 'ECONNREFUSED') {
    if (!capturedCallback) throw new Error('https.request was not called');
    // Trigger the 'error' handler registered via req.on('error', ...)
    const errorCall = mockOn.mock.calls.find(([evt]) => evt === 'error');
    if (errorCall) errorCall[1](new Error(message));
}

// ── Reset between tests ──────────────────────────────────────────────────────
beforeEach(() => {
    jest.clearAllMocks();
    capturedOptions = null;
    capturedCallback = null;
    process.env.ZALO_OA_ACCESS_TOKEN = 'test_token_abc';
    process.env.ZALO_ZNS_TEMPLATE_CHECKIN = 'tpl_checkin_123';
    process.env.ZALO_ZNS_TEMPLATE_CHECKOUT = 'tpl_checkout_456';
});

// ── SUITE 1: formatPhone ────────────────────────────────────────────────────
describe('formatPhone', () => {
    it('converts 0xxxxxxxxx → 84xxxxxxxxx', () => {
        expect(zaloService.formatPhone('0912345678')).toBe('84912345678');
    });

    it('leaves already-formatted 84xxxxxxxxx unchanged', () => {
        expect(zaloService.formatPhone('84912345678')).toBe('84912345678');
    });

    it('handles 9-digit number (no leading 0 or 84)', () => {
        expect(zaloService.formatPhone('912345678')).toBe('84912345678');
    });

    it('returns null for null/undefined input', () => {
        expect(zaloService.formatPhone(null)).toBeNull();
        expect(zaloService.formatPhone(undefined)).toBeNull();
    });

    it('returns null for a clearly invalid short number', () => {
        expect(zaloService.formatPhone('123')).toBeNull();
    });

    it('strips non-digit characters before formatting', () => {
        expect(zaloService.formatPhone('0912 345 678')).toBe('84912345678');
        expect(zaloService.formatPhone('+84912345678')).toBe('84912345678');
    });
});

// ── SUITE 2: sendZnsCheckin ──────────────────────────────────────────────────
describe('sendZnsCheckin', () => {
    it('calls https.request with correct url and body shape', async () => {
        const promise = zaloService.sendZnsCheckin(
            '0912345678',
            'Nguyen Van A',
            'PT Minh',
            new Date('2025-01-15T08:00:00+07:00'),
            'FitCity Quan 1'
        );
        simulateSuccess();
        await promise;

        expect(https.request).toHaveBeenCalledTimes(1);

        // Verify endpoint
        expect(capturedOptions.hostname).toBe('business.openapi.zalo.me');
        expect(capturedOptions.path).toBe('/message/template');
        expect(capturedOptions.method).toBe('POST');

        // Verify auth header
        expect(capturedOptions.headers['access_token']).toBe('test_token_abc');
        expect(capturedOptions.headers['Content-Type']).toBe('application/json');

        // Verify body written to request
        expect(mockWrite).toHaveBeenCalledTimes(1);
        const writtenBody = JSON.parse(mockWrite.mock.calls[0][0]);
        expect(writtenBody.phone).toBe('84912345678');
        expect(writtenBody.template_id).toBe('tpl_checkin_123');
        expect(writtenBody.template_data).toMatchObject({
            client_name: 'Nguyen Van A',
            pt_name: 'PT Minh',
            branch_name: 'FitCity Quan 1'
        });
        expect(writtenBody.template_data.session_time).toBeDefined();
    });

    it('does NOT throw when https throws a network error', async () => {
        const promise = zaloService.sendZnsCheckin(
            '0912345678',
            'Client',
            'PT',
            new Date(),
            'Branch'
        );
        simulateNetworkError('ECONNREFUSED');
        // Must resolve (not reject) — returns null
        await expect(promise).resolves.toBeNull();
    });

    it('returns null and does not throw when token is missing', async () => {
        delete process.env.ZALO_OA_ACCESS_TOKEN;
        const result = await zaloService.sendZnsCheckin('0912345678', 'A', 'B', new Date(), 'C');
        expect(result).toBeNull();
        expect(https.request).not.toHaveBeenCalled();
    });

    it('returns null and does not throw when template ID is missing', async () => {
        delete process.env.ZALO_ZNS_TEMPLATE_CHECKIN;
        const result = await zaloService.sendZnsCheckin('0912345678', 'A', 'B', new Date(), 'C');
        expect(result).toBeNull();
        expect(https.request).not.toHaveBeenCalled();
    });

    it('returns null and does not throw for invalid phone', async () => {
        const result = await zaloService.sendZnsCheckin('invalid', 'A', 'B', new Date(), 'C');
        expect(result).toBeNull();
        expect(https.request).not.toHaveBeenCalled();
    });
});

// ── SUITE 3: sendZnsCheckout ─────────────────────────────────────────────────
describe('sendZnsCheckout', () => {
    it('calls https.request with correct url and body shape', async () => {
        const start = new Date('2025-01-15T08:00:00+07:00');
        const end = new Date('2025-01-15T09:05:00+07:00');

        const promise = zaloService.sendZnsCheckout(
            '0987654321',
            'Tran Thi B',
            'PT Long',
            start,
            end
        );
        simulateSuccess();
        await promise;

        expect(https.request).toHaveBeenCalledTimes(1);
        expect(capturedOptions.hostname).toBe('business.openapi.zalo.me');
        expect(capturedOptions.path).toBe('/message/template');

        const writtenBody = JSON.parse(mockWrite.mock.calls[0][0]);
        expect(writtenBody.phone).toBe('84987654321');
        expect(writtenBody.template_id).toBe('tpl_checkout_456');
        expect(writtenBody.template_data).toMatchObject({
            client_name: 'Tran Thi B',
            pt_name: 'PT Long'
        });
        expect(writtenBody.template_data.start_time).toBeDefined();
        expect(writtenBody.template_data.end_time).toBeDefined();
        // 65 minutes session
        expect(writtenBody.template_data.duration).toBe('65 phút');
    });

    it('does NOT throw when https throws a network error', async () => {
        const promise = zaloService.sendZnsCheckout(
            '0987654321',
            'Client',
            'PT',
            new Date(),
            new Date()
        );
        simulateNetworkError('ETIMEDOUT');
        await expect(promise).resolves.toBeNull();
    });

    it('returns null and does not throw when token is missing', async () => {
        delete process.env.ZALO_OA_ACCESS_TOKEN;
        const result = await zaloService.sendZnsCheckout('0987654321', 'A', 'B', new Date(), new Date());
        expect(result).toBeNull();
    });
});
