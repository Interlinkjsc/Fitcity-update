const mongoose = require('mongoose');
const Contract = require('../../src/modules/contracts/models/contractModel.js');

describe('Contract Model Unit Test', () => {
    it('Should be valid for a complete contract', async () => {
        const contractData = {
            client: new mongoose.Types.ObjectId(),
            servicePackage: new mongoose.Types.ObjectId(),
            branch: new mongoose.Types.ObjectId(),
            sales: new mongoose.Types.ObjectId(),
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 Year from now
            basePrice: 5000000,
            discount: 500000,
            vat: 10,
            totalAmount: (5000000 - 500000) * 1.1,
            paidAmount: 2000000,
            paymentStatus: 'Deposit',
            contractStatus: 'Active',
            packageSnapshot: {
                name: 'Gói Premium',
                duration: 365,
                price: 5000000
            }
        };
        const contract = new Contract(contractData);
        const err = contract.validateSync();
        expect(err).toBeUndefined();
    });

    it('Should fail if endDate is before startDate', async () => {
        const contractData = {
            client: new mongoose.Types.ObjectId(),
            servicePackage: new mongoose.Types.ObjectId(),
            branch: new mongoose.Types.ObjectId(),
            sales: new mongoose.Types.ObjectId(),
            startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // Start in 10 days
            endDate: new Date(), // End now (invalid)
            basePrice: 1000000,
            totalAmount: 1100000,
            packageSnapshot: {
                name: 'Gói Cơ Bản',
                duration: 30,
                price: 1000000
            }
        };
        const contract = new Contract(contractData);
        const err = contract.validateSync();
        expect(err.errors.endDate).toBeDefined();
    });

    it('Should fail if discount is negative', async () => {
        const contract = new Contract({
            discount: -100,
            basePrice: 1000000,
            totalAmount: 1000000,
            packageSnapshot: {
                name: 'Gói Cơ Bản',
                duration: 30,
                price: 1000000
            }
        });
        const err = contract.validateSync();
        expect(err.errors.discount).toBeDefined();
    });

    it('Should fail if discount is higher than basePrice', async () => {
        const contract = new Contract({
            discount: 1500000,
            basePrice: 1000000,
            totalAmount: 0,
            packageSnapshot: {
                name: 'Gói Cơ Bản',
                duration: 30,
                price: 1000000
            }
        });
        const err = contract.validateSync();
        expect(err.errors.discount).toBeDefined();
    });

    it('Should fail if totalAmount is missing', async () => {
        const contract = new Contract({
            basePrice: 1000000,
            discount: 0,
            packageSnapshot: {
                name: 'Gói Cơ Bản',
                duration: 30,
                price: 1000000
            }
        });
        const err = contract.validateSync();
        expect(err.errors.totalAmount).toBeDefined();
    });

    it('PT should be optional for a Gym package', async () => {
        const contract = new Contract({
            client: new mongoose.Types.ObjectId(),
            servicePackage: new mongoose.Types.ObjectId(),
            branch: new mongoose.Types.ObjectId(),
            sales: new mongoose.Types.ObjectId(),
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            basePrice: 1000000,
            totalAmount: 1000000,
            packageSnapshot: {
                name: 'Gói Cơ Bản',
                duration: 30,
                price: 1000000
            }
            // pt is missing - should be OK
        });
        const err = contract.validateSync();
        expect(err).toBeUndefined(); 
    });
});
