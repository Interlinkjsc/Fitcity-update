const mongoose = require('mongoose');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');

describe('Service Package Model - Validation & Targets', () => {
    it('Should successfully create a package with valid targets', async () => {
        const pkg = new ServicePackage({
            name: 'Gói Pilates Trị Liệu',
            type: 'Pilates',
            target: 'Pilates',
            duration: 30,
            price: 5000000,
            sessionType: '1-1'
        });

        const error = pkg.validateSync();
        expect(error).toBeUndefined();
    });

    it('Should reject a package with invalid target', async () => {
        const pkg = new ServicePackage({
            name: 'Gói Sai Mục Tiêu',
            type: 'Gym',
            target: 'BoiLoi', // Invalid Enum
            duration: 30,
            price: 2000000
        });

        const error = pkg.validateSync();
        expect(error).toBeDefined();
        expect(error.errors['target']).toBeDefined();
    });

    it('Should reject a package with invalid type', async () => {
        const pkg = new ServicePackage({
            name: 'Gói Sai Loại',
            type: 'SaiLoai', // Invalid Enum
            target: 'Gym',
            duration: 30,
            price: 2000000
        });

        const error = pkg.validateSync();
        expect(error).toBeDefined();
        expect(error.errors['type']).toBeDefined();
    });

    it('Should reject a package with negative price or duration', async () => {
        const pkg = new ServicePackage({
            name: 'Gói Giá Âm',
            type: 'Gym',
            target: 'Gym',
            duration: -5,
            price: -100
        });

        const error = pkg.validateSync();
        expect(error).toBeDefined();
        expect(error.errors['price']).toBeDefined();
        expect(error.errors['duration']).toBeDefined();
    });
});
