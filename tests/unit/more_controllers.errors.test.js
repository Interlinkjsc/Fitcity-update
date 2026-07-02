const couponController = require('../../src/modules/finance/controllers/couponController.js');
const expenseController = require('../../src/modules/finance/controllers/expenseController.js');
const packageController = require('../../src/modules/programs/controllers/packageController.js');
const Coupon = require('../../src/modules/finance/models/couponModel.js');
const Expense = require('../../src/modules/finance/models/expenseModel.js');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const Payroll = require('../../src/modules/finance/models/payrollModel.js');
const Violation = require('../../src/modules/crm/models/violationModel.js');
const payrollController = require('../../src/modules/finance/controllers/payrollController.js');

describe('More Controller Error Coverage', () => {
    jest.setTimeout(30000);

    let req, res, next;
    beforeEach(() => {
        req = { 
            params: {}, 
            body: { month: 4, year: 2024, period: 1 }, 
            query: { month: 4, year: 2024 },
            flash: jest.fn(), 
            session: { user: { id: 'u1' } } 
        };
        res = { render: jest.fn(), redirect: jest.fn(), status: jest.fn().mockReturnThis() };
        next = jest.fn();
    });

    it('getCouponList error', async () => {
        const chain = {
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockRejectedValue(new Error('err'))
        };
        jest.spyOn(Coupon, 'find').mockReturnValue(chain);
        jest.spyOn(Coupon, 'countDocuments').mockResolvedValue(0);
        await couponController.getCouponList(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('storeCoupon catch error', async () => {
        jest.spyOn(Coupon, 'create').mockRejectedValue(new Error('Validation fail'));
        await couponController.storeCoupon(req, res, next);
        expect(res.redirect).toHaveBeenCalledWith('/admin/coupons/create');
    });

    it('deleteCoupon error', async () => {
        jest.spyOn(Coupon, 'findByIdAndDelete').mockRejectedValue(new Error('err'));
        await couponController.deleteCoupon(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('getAllExpenses error', async () => {
        jest.spyOn(Expense, 'find').mockImplementation(() => ({ populate: jest.fn().mockReturnThis(), sort: jest.fn().mockImplementation(() => { throw new Error('err'); }) }));
        jest.spyOn(Expense, 'countDocuments').mockResolvedValue(0);
        jest.spyOn(Expense, 'aggregate').mockResolvedValue([]);
        await expenseController.getAllExpenses(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('saveExpense error', async () => {
        jest.spyOn(Expense, 'create').mockRejectedValue(new Error('fail'));
        await expenseController.saveExpense(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('getPackageList error', async () => {
        const chain = {
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockRejectedValue(new Error('err'))
        };
        jest.spyOn(ServicePackage, 'find').mockReturnValue(chain);
        jest.spyOn(ServicePackage, 'countDocuments').mockResolvedValue(0);
        await packageController.getPackageList(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('getPayrollSummary for Sales/Manager', async () => {
        jest.spyOn(User, 'countDocuments').mockResolvedValue(1);
        jest.spyOn(User, 'find').mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([{ _id: 'u2', role: 'Sales', baseSalary: 6000000, status: 'Active' }])
        });
        jest.spyOn(Contract, 'find').mockResolvedValue([{ totalAmount: 1000000 }]);
        jest.spyOn(Payroll, 'findOne').mockResolvedValue(null);
        jest.spyOn(Contract, 'countDocuments').mockResolvedValue(0);
        jest.spyOn(Violation, 'find').mockResolvedValue([]);
        await payrollController.getPayrollSummary(req, res, next);
        expect(res.render).toHaveBeenCalledWith('admin/payroll/summary', expect.any(Object));
    });

    it('getPayrollSummary error', async () => {
        jest.spyOn(User, 'find').mockImplementation(() => { throw new Error('err'); });
        await payrollController.getPayrollSummary(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('finalizePayroll catch error', async () => {
        jest.spyOn(User, 'findById').mockRejectedValue(new Error('Staff not found'));
        await payrollController.finalizePayroll(req, res, next);
        expect(res.redirect).toHaveBeenCalledWith('/admin/payroll');
    });

    it('finalizePayroll existing Paid', async () => {
        jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'u1', name: 'N' });
        jest.spyOn(Payroll, 'findOne').mockResolvedValue({ status: 'Paid' });
        const payrollService = require('../../src/modules/finance/services/payrollService.js');
        jest.spyOn(payrollService, 'generateBiMonthlyPayroll').mockResolvedValue([{ _id: 'p1' }, { _id: 'p2' }]);
        await payrollController.finalizePayroll(req, res, next);
        // Controller hiện tại không chặn "đã Paid" ở đây; nó luôn tạo 2 kỳ theo service
        expect(req.flash).toHaveBeenCalledWith('success_msg', expect.stringContaining('Đã tạo 2 kỳ lương'));
        expect(res.redirect).toHaveBeenCalledWith('/admin/payroll?month=4&year=2024');
    });
});
