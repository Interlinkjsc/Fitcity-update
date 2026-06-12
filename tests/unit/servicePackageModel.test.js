const mongoose = require('mongoose');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');

describe('ServicePackage Model Unit Test', () => {
    it('Should be valid for a Gym package', async () => {
        const pkg = new ServicePackage({
            name: 'Gym 12 Months',
            type: 'Gym',
            duration: 365,
            price: 5000000
        });
        const err = pkg.validateSync();
        expect(err).toBeUndefined();
    });

    it('Should be valid for a Pilates package with sessions', async () => {
        const pkg = new ServicePackage({
            name: 'Pilates 24 Sessions',
            type: 'Pilates',
            duration: 90,
            sessions: 24,
            price: 12000000
        });
        const err = pkg.validateSync();
        expect(err).toBeUndefined();
    });

    it('Should fail if price is negative', async () => {
        const pkg = new ServicePackage({
            name: 'Bad Price',
            type: 'Gym',
            duration: 30,
            price: -100
        });
        const err = pkg.validateSync();
        expect(err.errors.price).toBeDefined();
    });

    it('Should fail if duration is less than 1 day', async () => {
        const pkg = new ServicePackage({
            name: 'Bad Duration',
            type: 'Gym',
            duration: 0,
            price: 1000000
        });
        const err = pkg.validateSync();
        expect(err.errors.duration).toBeDefined();
    });

    it('Should fail if type is invalid', async () => {
        const pkg = new ServicePackage({
            name: 'Bad Type',
            type: 'Kick-boxing-unknown',
            duration: 30,
            price: 1000000
        });
        const err = pkg.validateSync();
        expect(err.errors.type).toBeDefined();
    });
});
