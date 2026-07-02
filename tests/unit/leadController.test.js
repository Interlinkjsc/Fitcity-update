const leadController = require('../../src/modules/crm/controllers/leadController.js');
const Lead = require('../../src/modules/crm/models/leadModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const cmsService = require('../../src/modules/crm/services/cmsService.js');
const notificationService = require('../../src/modules/platform/services/notificationService.js');

describe('Lead Controller', () => {
    const mockRes = () => {
        const res = {};
        res.render = jest.fn().mockReturnValue(res);
        res.redirect = jest.fn().mockReturnValue(res);
        return res;
    };

    afterEach(() => jest.restoreAllMocks());

    describe('getLandingPage', () => {
        it('Should redirect guests to the black website (landing trắng đã thay bằng web đen)', async () => {
            const req = { flash: jest.fn().mockReturnValue([]), session: {} };
            const res = mockRes();
            const next = jest.fn();

            await leadController.getLandingPage(req, res, next);

            expect(res.redirect).toHaveBeenCalled();
            expect(res.render).not.toHaveBeenCalled();
        });

        it('Should redirect logged-in users to role dashboard', async () => {
            const req = { flash: jest.fn().mockReturnValue([]), session: { user: { role: 'PT' } } };
            const res = mockRes();
            const next = jest.fn();

            await leadController.getLandingPage(req, res, next);

            expect(res.redirect).toHaveBeenCalledWith('/pt');
        });
    });

    describe('registerLead', () => {
        beforeEach(() => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null)
                })
            });
            jest.spyOn(User, 'find').mockReturnValue({
                select: jest.fn().mockResolvedValue([])
            });
            jest.spyOn(notificationService, 'pushNotification').mockResolvedValue(undefined);
        });

        it('Should create a lead and redirect with success message', async () => {
            jest.spyOn(Lead, 'create').mockResolvedValue({ id: 'lead123' });
            
            const req = { 
                body: { name: 'John', phone: '0912345678', branchId: '507f1f77bcf86cd799439011' },
                flash: jest.fn()
            };
            const res = mockRes();
            const next = jest.fn();

            await leadController.registerLead(req, res, next);

            expect(Lead.create).toHaveBeenCalled();
            expect(req.flash).toHaveBeenCalledWith('success_msg', expect.any(String));
            expect(res.redirect).toHaveBeenCalledWith('/#trial');
        });

        it('Should not create lead when email belongs to an existing Client (R1)', async () => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({ _id: '507f191e810c19729de860ea' })
                })
            });
            const createSpy = jest.spyOn(Lead, 'create').mockResolvedValue({ id: 'lead123' });

            const req = {
                body: {
                    name: 'Dup',
                    phone: '0912345678',
                    email: 'already.client@fitcity.com',
                    branchId: '507f1f77bcf86cd799439011',
                    source: 'Website'
                },
                flash: jest.fn()
            };
            const res = mockRes();

            await leadController.registerLead(req, res, jest.fn());

            expect(createSpy).not.toHaveBeenCalled();
            expect(req.flash).toHaveBeenCalledWith('error_msg', expect.stringContaining('đăng nhập'));
            expect(res.redirect).toHaveBeenCalledWith('/auth/login');
        });

        it('Should redirect to /contact on R1 when source is Contact', async () => {
            jest.spyOn(User, 'findOne').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({ _id: '507f191e810c19729de860ea' })
                })
            });
            jest.spyOn(Lead, 'create').mockResolvedValue({ id: 'lead123' });

            const req = {
                body: {
                    name: 'Dup',
                    phone: '0912345679',
                    email: 'already2.client@fitcity.com',
                    branchId: '507f1f77bcf86cd799439011',
                    source: 'Contact'
                },
                flash: jest.fn()
            };
            const res = mockRes();

            await leadController.registerLead(req, res, jest.fn());

            expect(Lead.create).not.toHaveBeenCalled();
            expect(res.redirect).toHaveBeenCalledWith('/contact');
        });
    });

    describe('getAllLeads', () => {
        it('Should render leads list for admin', async () => {
            jest.spyOn(Lead, 'find').mockImplementation(() => ({
                populate: jest.fn().mockImplementation(() => ({
                    sort: jest.fn().mockReturnValue({
                        skip: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([])
                        })
                    })
                }))
            }));
            jest.spyOn(Lead, 'countDocuments').mockResolvedValue(0);
            jest.spyOn(Lead, 'aggregate').mockResolvedValue([]);
            jest.spyOn(Branch, 'find').mockResolvedValue([]);
            jest.spyOn(Contract, 'countDocuments').mockResolvedValue(0);
            
            const req = { query: {} };
            const res = mockRes();
            const next = jest.fn();

            await leadController.getAllLeads(req, res, next);

            expect(res.render).toHaveBeenCalledWith('admin/leads/list', expect.objectContaining({
                leads: [],
                activePage: 'leads'
            }));
        });
    });

    describe('getDetail', () => {
        it('Should redirect to /admin/leads when lead not found', async () => {
            const chain = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null)
            };
            jest.spyOn(Lead, 'findById').mockReturnValue(chain);

            const req = { params: { id: '507f191e810c19729de860ea' }, flash: jest.fn() };
            const res = mockRes();
            const next = jest.fn();

            await leadController.getDetail(req, res, next);
            expect(req.flash).toHaveBeenCalledWith('error_msg', expect.any(String));
            expect(res.redirect).toHaveBeenCalledWith('/admin/leads');
        });
    });
});
