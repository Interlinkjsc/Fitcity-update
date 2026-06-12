/**
 * Auth Controller Unit Tests (Mock DB + Session + Flash)
 */
const authController = require('../../src/modules/auth/controllers/authController.js');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const clientManagementService = require('../../src/modules/clients/services/clientManagementService.js');

describe('Auth Controller Unit Tests', () => {

    const mockReq = (body = {}, session = {}) => {
        const req = {
            body,
            session: {
                ...session,
                save: jest.fn(cb => cb ? cb() : null)
            },
            flash: jest.fn()
        };
        return req;
    };

    const mockRes = () => {
        const res = {};
        res.redirect = jest.fn().mockReturnValue(res);
        res.status = jest.fn().mockReturnValue(res);
        res.render = jest.fn().mockReturnValue(res);
        res.clearCookie = jest.fn().mockReturnValue(res);
        return res;
    };

    afterEach(() => jest.restoreAllMocks());

    describe('showLogin', () => {
        it('Should render login view with branches', async () => {
            jest.spyOn(Branch, 'find').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([{ _id: 'b1', name: 'CN A' }])
                    })
                })
            });
            const req = { query: {} };
            const res = mockRes();
            await authController.showLogin(req, res);
            expect(res.render).toHaveBeenCalledWith('login', expect.objectContaining({
                branches: [{ _id: 'b1', name: 'CN A' }],
                view: 'login'
            }));
        });

        it('Should render register tab when view=register', async () => {
            jest.spyOn(Branch, 'find').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([])
                    })
                })
            });
            const req = { query: { view: 'register' } };
            const res = mockRes();
            await authController.showLogin(req, res);
            expect(res.render).toHaveBeenCalledWith('login', expect.objectContaining({ view: 'register' }));
        });
    });

    describe('register', () => {
        it('Should redirect if required fields missing', async () => {
            const req = mockReq({ name: '', email: 'a@b.com', password: '123456', branch: 'b1' });
            const res = mockRes();
            await authController.register(req, res);
            expect(req.flash).toHaveBeenCalledWith('error_msg', expect.any(String));
            expect(res.redirect).toHaveBeenCalledWith('/auth/login?view=register');
        });

        it('Should redirect if passwords do not match', async () => {
            const req = mockReq({
                name: 'Test User',
                email: 'a@b.com',
                password: '123456',
                confirmPassword: '654321',
                branch: 'b1'
            });
            const res = mockRes();
            await authController.register(req, res);
            expect(req.flash).toHaveBeenCalledWith('error_msg', 'Mật khẩu xác nhận không khớp');
            expect(res.redirect).toHaveBeenCalledWith('/auth/login?view=register');
        });

        it('Should create client, start session and redirect to /client on success', async () => {
            const createdUser = {
                _id: 'u1',
                name: 'Test User',
                email: 'new@test.com',
                role: 'Client',
                branch: 'b1',
                avatar: '/images/default-avatar.png'
            };
            jest.spyOn(clientManagementService, 'createClient').mockResolvedValue(createdUser);
            const req = mockReq({
                name: 'Test User',
                email: 'new@test.com',
                password: '123456',
                confirmPassword: '123456',
                branch: 'b1',
                phone: '0912345678'
            });
            const res = mockRes();
            await authController.register(req, res);
            expect(clientManagementService.createClient).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Test User',
                email: 'new@test.com',
                role: 'Client',
                status: 'Active',
                branch: 'b1'
            }));
            expect(req.flash).toHaveBeenCalledWith('success_msg', expect.any(String));
            expect(req.session.user).toEqual(expect.objectContaining({
                id: 'u1',
                name: 'Test User',
                role: 'Client'
            }));
            expect(req.session.save).toHaveBeenCalled();
            expect(res.redirect).toHaveBeenCalledWith('/client');
        });

        it('Should redirect on duplicate email', async () => {
            const err = new clientManagementService.ClientServiceError('Email này đã được sử dụng!', 'DUPLICATE_EMAIL');
            jest.spyOn(clientManagementService, 'createClient').mockRejectedValue(err);
            const req = mockReq({
                name: 'Test User',
                email: 'dup@test.com',
                password: '123456',
                confirmPassword: '123456',
                branch: 'b1'
            });
            const res = mockRes();
            await authController.register(req, res);
            expect(req.flash).toHaveBeenCalledWith('error_msg', 'Email này đã được sử dụng!');
            expect(res.redirect).toHaveBeenCalledWith('/auth/login?view=register');
        });
    });

    describe('login', () => {
        it('Should redirect if email missing', async () => {
            const req = mockReq({ email: '', password: '123456' });
            const res = mockRes();
            await authController.login(req, res);
            expect(req.flash).toHaveBeenCalledWith('error_msg', expect.any(String));
            expect(res.redirect).toHaveBeenCalledWith('/auth/login');
        });

        it('Should redirect if password missing', async () => {
            const req = mockReq({ email: 'test@test.com', password: '' });
            const res = mockRes();
            await authController.login(req, res);
            expect(res.redirect).toHaveBeenCalledWith('/auth/login');
        });

        it('Should redirect if user not found', async () => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });
            const req = mockReq({ email: 'noone@test.com', password: '123456' });
            const res = mockRes();
            await authController.login(req, res);
            expect(res.redirect).toHaveBeenCalledWith('/auth/login');
        });

        it('Should redirect if password is wrong', async () => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    correctPassword: jest.fn().mockResolvedValue(false),
                    status: 'Active',
                    save: jest.fn().mockResolvedValue(true)
                })
            });
            const req = mockReq({ email: 'test@test.com', password: 'wrong' });
            const res = mockRes();
            await authController.login(req, res);
            expect(res.redirect).toHaveBeenCalledWith('/auth/login');
        });

        it('Should redirect if user is banned', async () => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    correctPassword: jest.fn().mockResolvedValue(true),
                    status: 'Banned'
                })
            });
            const req = mockReq({ email: 'banned@test.com', password: '123456' });
            const res = mockRes();
            await authController.login(req, res);
            expect(req.flash).toHaveBeenCalledWith('error_msg', expect.stringContaining('khóa'));
            expect(res.redirect).toHaveBeenCalledWith('/auth/login');
        });

        it('Should redirect Admin to /admin', async () => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'testid', name: 'Admin', email: 'admin@test.com',
                    role: 'Admin', branch: 'b1', avatar: '/img.png',
                    correctPassword: jest.fn().mockResolvedValue(true),
                    status: 'Active', password: 'hash',
                    save: jest.fn().mockResolvedValue(true)
                })
            });
            const req = mockReq({ email: 'admin@test.com', password: '123456' }, {});
            const res = mockRes();
            await authController.login(req, res);
            expect(res.redirect).toHaveBeenCalledWith('/admin');
        });

        it('Should redirect PT to /pt', async () => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'testid', name: 'PT', email: 'pt@test.com',
                    role: 'PT', branch: 'b1', avatar: '/img.png',
                    correctPassword: jest.fn().mockResolvedValue(true),
                    status: 'Active', password: 'hash',
                    save: jest.fn().mockResolvedValue(true)
                })
            });
            const req = mockReq({ email: 'pt@test.com', password: '123456' }, {});
            const res = mockRes();
            await authController.login(req, res);
            expect(res.redirect).toHaveBeenCalledWith('/pt');
        });

        it('Should redirect Client to /client', async () => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'testid', name: 'Client', email: 'c@test.com',
                    role: 'Client', branch: 'b1', avatar: '/img.png',
                    correctPassword: jest.fn().mockResolvedValue(true),
                    status: 'Active', password: 'hash',
                    save: jest.fn().mockResolvedValue(true)
                })
            });
            const req = mockReq({ email: 'c@test.com', password: '123456' }, {});
            const res = mockRes();
            await authController.login(req, res);
            expect(res.redirect).toHaveBeenCalledWith('/client');
        });

        it('Should redirect Sales to /admin', async () => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'testid', name: 'Sales', email: 's@test.com',
                    role: 'Sales', branch: 'b1', avatar: '/img.png',
                    correctPassword: jest.fn().mockResolvedValue(true),
                    status: 'Active', password: 'hash',
                    save: jest.fn().mockResolvedValue(true)
                })
            });
            const req = mockReq({ email: 's@test.com', password: '123456' }, {});
            const res = mockRes();
            await authController.login(req, res);
            expect(res.redirect).toHaveBeenCalledWith('/admin');
        });

        it('Should handle DB error gracefully', async () => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockRejectedValue(new Error('DB Error'))
            });
            const req = mockReq({ email: 'x@x.com', password: '123456' });
            const res = mockRes();
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            await authController.login(req, res);
            expect(req.flash).toHaveBeenCalledWith('error_msg', expect.any(String));
            expect(res.redirect).toHaveBeenCalledWith('/auth/login');
            consoleSpy.mockRestore();
        });
    });

    describe('logout', () => {
        it('Should destroy session and redirect', () => {
            const req = {
                session: {
                    destroy: jest.fn(cb => cb(null))
                }
            };
            const res = mockRes();
            authController.logout(req, res);
            expect(req.session.destroy).toHaveBeenCalled();
            expect(res.redirect).toHaveBeenCalledWith('/auth/login');
        });

        it('Should handle destroy error gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const req = {
                session: {
                    destroy: jest.fn(cb => cb(new Error('Session Error')))
                }
            };
            const res = mockRes();
            authController.logout(req, res);
            expect(res.redirect).toHaveBeenCalledWith('/auth/login');
            consoleSpy.mockRestore();
        });
    });

    describe('getProfile', () => {
        it('Should render profile with user data', async () => {
            jest.spyOn(User, 'findById').mockReturnValue({
                populate: jest.fn().mockResolvedValue({ name: 'User', email: 'u@test.com' })
            });
            const req = { session: { user: { id: 'testid' } } };
            const res = mockRes();
            await authController.getProfile(req, res);
            expect(res.render).toHaveBeenCalledWith('profile', expect.objectContaining({ user: expect.any(Object) }));
        });

        it('Should handle error in getProfile', async () => {
            jest.spyOn(User, 'findById').mockReturnValue({
                populate: jest.fn().mockRejectedValue(new Error('DB Error'))
            });
            const req = { session: { user: { id: 'testid' } } };
            const res = mockRes();
            await authController.getProfile(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.render).toHaveBeenCalledWith('error', expect.any(Object));
        });
    });
});
