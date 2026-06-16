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

    it('Should accept a free-form custom target (form has a "Mục tiêu khác" custom-text option)', async () => {
        // target is intentionally free-form (trim: true, no enum) because the
        // create/edit form lets staff type an arbitrary custom goal via the
        // "Mục tiêu khác" option — a fixed enum would reject those legitimate values.
        const pkg = new ServicePackage({
            name: 'Gói Mục Tiêu Tuỳ Chỉnh',
            type: 'Gym',
            target: 'Chạy bộ marathon',
            duration: 30,
            price: 2000000
        });

        const error = pkg.validateSync();
        expect(error).toBeUndefined();
        expect(pkg.target).toBe('Chạy bộ marathon');
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
