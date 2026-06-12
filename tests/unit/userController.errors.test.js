const userController = require('../../src/modules/users/controllers/userController.js');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');

describe('User Controller - Error Handling coverage', () => {
    let req, res, next;

    beforeEach(() => {
        req = { params: {}, body: {}, flash: jest.fn(), session: {} };
        res = { 
            render: jest.fn(), 
            redirect: jest.fn(), 
            status: jest.fn().mockReturnThis(), 
            json: jest.fn() 
        };
        next = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('getUserList should handle errors', async () => {
        jest.spyOn(User, 'find').mockImplementation(() => ({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockRejectedValue(new Error('DB Error'))
        }));
        await userController.getUserList(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('getCreateForm should handle errors', async () => {
        jest.spyOn(Branch, 'find').mockRejectedValue(new Error('DB Error'));
        await userController.getCreateForm(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('storeUser should handle general errors', async () => {
        jest.spyOn(User, 'findOne').mockRejectedValue(new Error('DB Error'));
        await userController.storeUser(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('getEditForm should handle errors', async () => {
        jest.spyOn(User, 'findById').mockRejectedValue(new Error('DB Error'));
        await userController.getEditForm(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('updateUser should handle general errors', async () => {
        req.params.id = 'someid';
        jest.spyOn(User, 'findOne').mockRejectedValue(new Error('DB Error'));
        await userController.updateUser(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('deleteUser should handle errors', async () => {
        jest.spyOn(User, 'findByIdAndDelete').mockRejectedValue(new Error('DB Error'));
        await userController.deleteUser(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
});
