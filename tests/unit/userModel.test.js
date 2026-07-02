const mongoose = require('mongoose');
const User = require('../../src/modules/users/models/userModel.js');
const bcrypt = require('bcryptjs');

describe('User Model Unit Test', () => {
    const validBranchId = new mongoose.Types.ObjectId();

    it('Should be valid for a Client with a Branch', async () => {
        const user = new User({
            name: 'Client A', email: 'client@example.com', password: 'password123',
            role: 'Client', branch: validBranchId, phone: '0901112223'
        });
        await expect(user.validate()).resolves.toBeUndefined();
    });

    it('Should be valid for SA without a Branch', async () => {
        const user = new User({
            name: 'Super Admin', email: 'sa@fitcity.com', password: 'password123', role: 'SA'
        });
        await expect(user.validate()).resolves.toBeUndefined();
    });

    it('Should be valid for Admin without a Branch', async () => {
        const user = new User({
            name: 'Admin', email: 'admin@fitcity.com', password: 'password123', role: 'Admin'
        });
        await expect(user.validate()).resolves.toBeUndefined();
    });

    it('Should be valid for PT without a Branch (assign later)', async () => {
        const user = new User({
            name: 'PT John', email: 'pt@fitcity.com', password: 'password123', role: 'PT'
        });
        await expect(user.validate()).resolves.toBeUndefined();
    });

    it('Should fail if email format is invalid', async () => {
        const user = new User({
            name: 'User', email: 'invalid-email', password: 'password123', role: 'SA'
        });
        try {
            await user.validate();
        } catch (err) {
            expect(err.errors.email).toBeDefined();
        }
    });

    it('Should fail if role is not in enum', async () => {
        const user = new User({
            name: 'User', email: 'user@example.com', password: 'password123', role: 'Hacker'
        });
        try {
            await user.validate();
        } catch (err) {
            expect(err.errors.role).toBeDefined();
        }
    });

    it('Should fail if phone format is invalid', async () => {
        const user = new User({
            name: 'User', email: 'user@example.com', password: 'password123',
            role: 'SA', phone: '123'
        });
        try {
            await user.validate();
        } catch (err) {
            expect(err.errors.phone).toBeDefined();
        }
    });

    it('Should accept valid Vietnam phone +84', async () => {
        const user = new User({
            name: 'User', email: 'user@example.com', password: 'password123',
            role: 'SA', phone: '+84901112223'
        });
        await expect(user.validate()).resolves.toBeUndefined();
    });

    it('Should accept empty phone (phone is optional)', async () => {
        const user = new User({
            name: 'User', email: 'user@example.com', password: 'password123', role: 'SA'
        });
        await expect(user.validate()).resolves.toBeUndefined();
    });

    it('Should fail if name is not provided', async () => {
        const user = new User({ email: 'user@example.com', password: 'password123', role: 'SA' });
        try {
            await user.validate();
        } catch (err) {
            expect(err.errors.name).toBeDefined();
        }
    });

    it('Should fail if password is too short', async () => {
        const user = new User({
            name: 'User', email: 'user@example.com', password: '123', role: 'SA'
        });
        try {
            await user.validate();
        } catch (err) {
            expect(err.errors.password).toBeDefined();
        }
    });

    it('Should default role to Client', async () => {
        const user = new User({
            name: 'User', email: 'user@test.com', password: '123456', branch: validBranchId
        });
        expect(user.role).toBe('Client');
    });

    it('Should default status to Active', async () => {
        const user = new User({
            name: 'User', email: 'user@test.com', password: '123456', role: 'SA'
        });
        expect(user.status).toBe('Active');
    });

    it('Should default avatar to /images/default-avatar-client.svg', async () => {
        const user = new User({
            name: 'User', email: 'user@test.com', password: '123456', role: 'SA'
        });
        expect(user.avatar).toBe('/images/default-avatar-client.svg');
    });

    describe('Password Hashing (pre-save hook)', () => {
        it('correctPassword should return true for matching passwords', async () => {
            const user = new User({
                name: 'Test', email: 'hash@test.com', password: '123456', role: 'SA'
            });
            const hashedPassword = await bcrypt.hash('123456', 12);
            const result = await user.correctPassword('123456', hashedPassword);
            expect(result).toBe(true);
        });

        it('correctPassword should return false for wrong passwords', async () => {
            const user = new User({
                name: 'Test', email: 'hash@test.com', password: '123456', role: 'SA'
            });
            const hashedPassword = await bcrypt.hash('123456', 12);
            const result = await user.correctPassword('wrongpassword', hashedPassword);
            expect(result).toBe(false);
        });
    });
});
