const mongoose = require('mongoose');
const User = require('../../src/modules/users/models/userModel.js');

describe('User Referral & Compliance Unit Tests', () => {
    let testSuffix;

    beforeAll(async () => {
        testSuffix = Date.now();
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        await mongoose.connect(MONGODB_URI);
    });

    afterAll(async () => {
        await User.deleteMany({});
        await mongoose.connection.close();
    });

    it('Should auto-generate a referralCode for a new Client', async () => {
        const client = await User.create({
            name: 'Referral User',
            email: 'ref_' + testSuffix + '@test.com',
            password: 'password123',
            role: 'Client',
            branch: new mongoose.Types.ObjectId()
        });

        expect(client.referralCode).toBeDefined();
        expect(client.referralCode.length).toBe(8);
    });

    it('Should NOT auto-generate a referralCode for a PT or Admin', async () => {
        const pt = await User.create({
            name: 'PT Trainer',
            email: 'pt_ref_' + testSuffix + '@test.com',
            password: 'password123',
            role: 'PT',
            branch: new mongoose.Types.ObjectId()
        });

        expect(pt.referralCode).toBeUndefined();
    });

    it('Should correctly store referredBy relation', async () => {
        const f0 = await User.create({
            name: 'F0 Leader',
            email: 'f0_' + testSuffix + '@test.com',
            password: 'password123',
            role: 'Client',
            branch: new mongoose.Types.ObjectId()
        });

        const f1 = await User.create({
            name: 'F1 Member',
            email: 'f1_' + testSuffix + '@test.com',
            password: 'password123',
            role: 'Client',
            branch: new mongoose.Types.ObjectId(),
            referredBy: f0._id
        });

        expect(f1.referredBy.toString()).toBe(f0._id.toString());
    });

    it('Should store tax and insurance document IDs', async () => {
        const accountant = await User.create({
            name: 'Accountant A',
            email: 'acc_' + testSuffix + '@test.com',
            password: 'password123',
            role: 'Accountant',
            branch: new mongoose.Types.ObjectId(),
            taxDocumentId: 'drive_tax_123',
            insuranceDocumentId: 'drive_ins_123'
        });

        expect(accountant.taxDocumentId).toBe('drive_tax_123');
        expect(accountant.insuranceDocumentId).toBe('drive_ins_123');
    });
});
