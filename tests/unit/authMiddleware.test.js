jest.mock('../../src/core/permissionService', () => ({
    ensureCache: jest.fn().mockResolvedValue({}),
    userHasPermissionSync: jest.fn()
}));

const { checkPermission } = require('../../src/middlewares/authMiddleware');
const permissionService = require('../../src/core/permissionService');

function mockReqRes(user, options = {}) {
    const req = {
        session: { user },
        params: options.params || {},
        query: options.query || {},
        body: options.body || {},
        accepts: (type) => (type === 'html' ? false : 'json'),
        xhr: false,
        method: options.method || 'GET',
        flash: jest.fn()
    };
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        redirect: jest.fn()
    };
    const next = jest.fn();
    return { req, res, next };
}

describe('authMiddleware.checkPermission', () => {
    beforeEach(() => {
        permissionService.userHasPermissionSync.mockImplementation((user, resource) => {
            if (user.role === 'Marketing' && resource === 'payroll') return false;
            if (resource === 'unknown_module') return false;
            return true;
        });
    });

    it('denies Marketing from payroll view', async () => {
        const middleware = checkPermission('payroll', 'view');
        const { req, res, next } = mockReqRes({ role: 'Marketing', id: '1' });
        await middleware(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'fail', message: 'Forbidden' }));
    });

    it('allows Accountant payroll view', async () => {
        permissionService.userHasPermissionSync.mockImplementation((user, resource) => {
            return user.role === 'Accountant' && resource === 'payroll';
        });
        const middleware = checkPermission('payroll', 'view');
        const { req, res, next } = mockReqRes({ role: 'Accountant', id: '1' });
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('denies unknown resource (fail-closed)', async () => {
        const middleware = checkPermission('unknown_module', 'view');
        const { req, res, next } = mockReqRes({ role: 'Admin', id: '1' });
        await middleware(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'fail' }));
    });

    it('SA bypasses all restrictions', async () => {
        permissionService.userHasPermissionSync.mockReturnValue(false);
        const middleware = checkPermission('unknown_module', 'view');
        const { req, res, next } = mockReqRes({ role: 'SA', id: '1' });
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
