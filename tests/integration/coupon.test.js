const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Coupon = require('../../src/modules/finance/models/couponModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('Coupon Integration', () => {
    let adminCookie;
    let adminUser;
    let couponId;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        await Coupon.deleteMany({ code: /^TESTCPN_/ });
        await User.deleteMany({ email: /@testcoupon\.com$/ });

        adminUser = await User.create({
            name: 'Coupon Admin',
            email: 'admin@testcoupon.com',
            password: 'password123',
            role: 'Admin',
            status: 'Active'
        });

        const loginRes = await request(app)
            .post('/auth/login')
            .send({ email: 'admin@testcoupon.com', password: 'password123' });
        adminCookie = loginRes.headers['set-cookie'];
    });

    afterAll(async () => {
        await Coupon.deleteMany({ code: /^TESTCPN_/ });
        await User.deleteMany({ email: /@testcoupon\.com$/ });
        await mongoose.connection.close();
    });

    it('Should create and delete coupon via POST route', async () => {
        const createRes = await request(app)
            .post('/admin/coupons/store')
            .set('Cookie', adminCookie)
            .send({
                code: 'TESTCPN_DEL01',
                type: 'Percentage',
                value: 15,
                maxDiscount: 500000,
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                usageLimit: 20
            });

        expect(createRes.statusCode).toBe(302);
        expect(createRes.headers.location).toBe('/admin/coupons');

        const created = await Coupon.findOne({ code: 'TESTCPN_DEL01' });
        expect(created).not.toBeNull();
        couponId = created._id;

        const deleteRes = await request(app)
            .post(`/admin/coupons/delete/${couponId}`)
            .set('Cookie', adminCookie);

        expect(deleteRes.statusCode).toBe(302);
        expect(deleteRes.headers.location).toBe('/admin/coupons');

        const deleted = await Coupon.findById(couponId);
        expect(deleted).toBeNull();
    });

    it('Should reject GET delete endpoint after method hardening', async () => {
        const res = await request(app)
            .get('/admin/coupons/delete/507f191e810c19729de860ea')
            .set('Cookie', adminCookie);

        expect(res.statusCode).toBe(404);
    });
});
