const mongoose = require('mongoose');
const User = require('../../src/modules/users/models/userModel.js');
const { encrypt, decrypt, hash } = require('../../src/utils/encryption');

describe('PII Encryption & Blind Index Tests', () => {
    beforeAll(async () => {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        await mongoose.connect(MONGODB_URI);
    });

    afterAll(async () => {
        await User.deleteMany();
        await mongoose.connection.close();
    });

    it('Should store encrypted email and phone but searchable by hash', async () => {
        const email = 'secure@fitcity.com';
        const phone = '0909998887';
        
        let user;
        try {
            user = await User.create({
                name: 'Encryption Test',
                email: email,
                phone: phone,
                password: 'password123',
                role: 'SA'
            });
        } catch (err) {
            console.error('Registration Error Details:', err.errors);
            throw err;
        }

        // 1. Verify hash is correct
        expect(user.emailHash).toBe(hash(email));
        expect(user.phoneHash).toBe(hash(phone));

        // 2. Verify find by hash works
        const found = await User.findOne({ emailHash: hash(email) });
        expect(found).toBeDefined();
        
        // 3. Verify getters decrypt the data
        expect(found.email).toBe(email);
        expect(found.phone).toBe(phone);

        // 4. Verify DB content is actually encrypted (manually check raw doc)
        const raw = await mongoose.connection.db.collection('users').findOne({ _id: user._id });
        expect(raw.email).not.toBe(email);
        expect(raw.email).toContain(':'); // IV separator
    });
});
