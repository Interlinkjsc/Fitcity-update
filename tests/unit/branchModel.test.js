const mongoose = require('mongoose');
const Branch = require('../../src/modules/crm/models/branchModel.js');

describe('Branch Model Unit Test', () => {
    it('Should be valid if all required fields are present', async () => {
        const branch = new Branch({
            name: '  FitCity Quận 1  ',
            address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
            phone: '0901234567',
            manager: new mongoose.Types.ObjectId()
        });
        
        const err = branch.validateSync();
        expect(err).toBeUndefined();
        // Kiểm tra trim whitespace
        expect(branch.name).toBe('FitCity Quận 1');
    });

    it('Should fail if name is missing', async () => {
        const branch = new Branch({ 
            address: '...', 
            phone: '0901234567' 
        });
        const err = branch.validateSync();
        expect(err.errors.name).toBeDefined();
    });

    it('Should fail if phone is invalid', async () => {
        const branch = new Branch({ 
            name: 'Chi nhánh X',
            address: '...',
            phone: 'not-a-phone' 
        });
        const err = branch.validateSync();
        expect(err.errors.phone).toBeDefined();
        expect(err.errors.phone.message).toContain('không phải là số điện thoại hợp lệ');
    });

    it('Should fail if status is invalid', async () => {
        const branch = new Branch({ 
            name: 'Chi nhánh Y',
            address: '...',
            phone: '0987654321',
            status: 'Deleted' 
        });
        const err = branch.validateSync();
        expect(err.errors.status).toBeDefined();
        expect(err.errors.status.message).toContain('không phải là trạng thái hợp lệ');
    });

    it('Should be valid without a manager (Pre-assignment)', async () => {
        const branch = new Branch({ 
            name: 'Chi nhánh mới',
            address: 'Địa chỉ',
            phone: '0123456789'
        });
        const err = branch.validateSync();
        expect(err).toBeUndefined();
    });
});
