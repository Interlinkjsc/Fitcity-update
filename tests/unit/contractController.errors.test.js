const contractController = require('../../src/modules/contracts/controllers/contractController.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const contractService = require('../../src/modules/contracts/services/contractService.js');
const pdfService = require('../../src/modules/contracts/services/pdfService.js');
const driveService = require('../../src/modules/platform/services/driveService.js');
const notificationService = require('../../src/modules/platform/services/notificationService.js');

jest.mock('../../src/modules/contracts/models/contractModel.js');
jest.mock('../../src/modules/programs/models/servicePackageModel.js');
jest.mock('../../src/modules/crm/models/branchModel.js');
jest.mock('../../src/modules/users/models/userModel.js');
jest.mock('../../src/modules/contracts/services/contractService.js');
jest.mock('../../src/modules/contracts/services/pdfService.js');
jest.mock('../../src/modules/platform/services/driveService.js');
jest.mock('../../src/modules/platform/services/notificationService.js');

describe('Contract Controller Error Handling', () => {
    let req, res, next;
    beforeEach(() => {
        req = { params: {}, body: { servicePackage: 'p1', clientId: 'c1', branchId: 'b1', salesId: 's1', startDate: new Date().toISOString() }, originalUrl: '/admin/contracts/create', flash: jest.fn(), session: { user: { id: 'u1', role: 'Admin' } } };
        res = { render: jest.fn(), redirect: jest.fn(), download: jest.fn() };
        next = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.clearAllMocks());

    it('downloadContract should handle missing contract', async () => {
        const mockQuery = {
            populate: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(null)
        };
        // Mocking the chain: findById().populate().populate().populate()
        // Here we just make populate return the query again, and the final behavior is null
        Contract.findById.mockReturnValue(mockQuery);
        mockQuery.populate.mockReturnValue(mockQuery); // Chainable
        
        // Final call in the async chain (even without .exec, Mongoose queries are thenable)
        mockQuery.then = jest.fn().mockImplementation(cb => cb(null)); 

        await contractController.downloadContract(req, res, next);
        expect(req.flash).toHaveBeenCalledWith('error_msg', 'Không tìm thấy hợp đồng!');
    });

    it('storeContract should handle validation error', async () => {
        contractService.createContract.mockRejectedValue({ name: 'ValidationError', errors: { x: { message: 'msg' } } });
        await contractController.storeContract(req, res, next);
        expect(res.redirect).toHaveBeenCalledWith('/admin/contracts/create');
    });

    it('storeContract should handle general error', async () => {
        contractService.createContract.mockRejectedValue(new Error('general_err'));
        await contractController.storeContract(req, res, next);
        expect(req.flash).toHaveBeenCalledWith('error_msg', 'general_err');
    });

    it('updateContract should handle validation error', async () => {
        req.params.id = 'c1';
        Contract.findByIdAndUpdate.mockRejectedValue({ name: 'ValidationError', errors: { x: { message: 'msg' } } });
        await contractController.updateContract(req, res, next);
        expect(res.redirect).toHaveBeenCalledWith('/admin/contracts/edit/c1');
    });

    it('deleteContract should handle missing contract', async () => {
        Contract.findById.mockResolvedValue(null);
        await contractController.deleteContract(req, res, next);
        expect(req.flash).toHaveBeenCalledWith('error_msg', 'Không tìm thấy hợp đồng!');
    });

    it('deleteContract should block non-SA on paid contracts', async () => {
        Contract.findById.mockResolvedValue({ paymentStatus: 'Paid' });
        req.session.user.role = 'Admin';
        await contractController.deleteContract(req, res, next);
        expect(req.flash).toHaveBeenCalledWith('error_msg', expect.any(String));
    });
});
