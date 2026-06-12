const branchController = require('../../src/modules/crm/controllers/branchController.js');
const clientController = require('../../src/modules/clients/controllers/clientController.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');

describe('Branch Controller Error Coverage', () => {
    let req, res, next;
    beforeEach(() => {
        req = { params: {}, body: {}, flash: jest.fn(), session: {}, headers: {} };
        res = { render: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
        next = jest.fn();
    });

    it('getBranchList error', async () => {
        jest.spyOn(Branch, 'find').mockImplementation(() => ({ populate: jest.fn().mockReturnThis(), sort: jest.fn().mockRejectedValue(new Error('err')) }));
        await branchController.getBranchList(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('getCreateForm error', async () => {
        jest.spyOn(User, 'find').mockRejectedValue(new Error('err'));
        await branchController.getCreateForm(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('storeBranch validation error', async () => {
        jest.spyOn(Branch, 'findOne').mockResolvedValue(null);
        jest.spyOn(Branch, 'create').mockRejectedValue({ name: 'ValidationError', errors: { n: { message: 'msg' } } });
        await branchController.storeBranch(req, res, next);
        expect(res.redirect).toHaveBeenCalledWith('/admin/branches/create');
    });

    it('storeBranch general error', async () => {
        jest.spyOn(Branch, 'findOne').mockRejectedValue(new Error('err'));
        await branchController.storeBranch(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('getEditForm error', async () => {
        jest.spyOn(Branch, 'findById').mockRejectedValue(new Error('err'));
        await branchController.getEditForm(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('updateBranch fake id', async () => {
        jest.spyOn(Branch, 'findOne').mockResolvedValue(null);
        jest.spyOn(Branch, 'findByIdAndUpdate').mockResolvedValue(null);
        await branchController.updateBranch(req, res, next);
        expect(res.redirect).toHaveBeenCalledWith('/admin/branches/list');
    });

    it('deleteBranch not found', async () => {
        jest.spyOn(User, 'findOne').mockResolvedValue(null);
        jest.spyOn(Branch, 'findByIdAndDelete').mockResolvedValue(null);
        await branchController.deleteBranch(req, res, next);
        expect(req.flash).toHaveBeenCalledWith('error_msg', 'Không tìm thấy chi nhánh!');
    });

    it('deleteBranch general error', async () => {
        jest.spyOn(User, 'findOne').mockRejectedValue(new Error('err'));
        await branchController.deleteBranch(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});

describe('Client Controller Error Coverage', () => {
    let req, res, next;
    beforeEach(() => { 
        req = { params: { id: 's1' }, body: {}, flash: jest.fn(), session: { user: { id: 'c1' } }, headers: {} }; 
        res = { render: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }; 
        next = jest.fn(); 
    });

    it('confirmSession error', async () => {
        jest.spyOn(WorkoutSession, 'findById').mockRejectedValue(new Error('err'));
        await clientController.confirmSession(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('confirmSession not found', async () => {
        jest.spyOn(WorkoutSession, 'findById').mockResolvedValue(null);
        await clientController.confirmSession(req, res, next);
        expect(req.flash).toHaveBeenCalledWith('error_msg', 'Không tìm thấy buổi tập!');
    });
});
