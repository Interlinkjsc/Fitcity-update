require('dotenv').config({ path: '.env.test' });
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Coupon = require('../../src/modules/finance/models/couponModel.js');

let mongoServer;
let adminCookie;
let testCouponId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create Admin User
    const admin = await User.create({
        name: 'Admin',
        email: 'admin_test@fitcity.com',
        password: 'password123',
        role: 'Admin'
    });

    // Login to get session cookie
    const loginRes = await request(app).post('/auth/login').send({
        email: 'admin_test@fitcity.com',
        password: 'password123'
    });
    
    adminCookie = loginRes.headers['set-cookie'];

    // Create a Dummy Coupon
    const coupon = await Coupon.create({
        code: 'TEST2026',
        type: 'Fixed',
        value: 100000,
        endDate: new Date(Date.now() + 86400000 * 30), // + 30 days
        createdBy: admin._id
    });
    testCouponId = coupon._id;
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Coupon Management - Fix Edit Bug', () => {
    test('Should successfully update via POST /admin/coupons/update/:id', async () => {
        const res = await request(app)
            .post(`/admin/coupons/update/${testCouponId}`)
            .set('Cookie', adminCookie)
            .send({
                type: 'Percentage',
                value: 20,
                maxDiscount: 50000,
                endDate: new Date(Date.now() + 86400000 * 60).toISOString(),
                usageLimit: 200
            });

        // Redirect after POST means success usually
        expect(res.status).toBe(302);
        
        const updated = await Coupon.findById(testCouponId);
        expect(updated.type).toBe('Percentage');
        expect(updated.value).toBe(20);
        expect(updated.usageLimit).toBe(200);
    });

    test('Integration: API PATCH /admin/coupons/:id phải trả về 200', async () => {
        const res = await request(app)
            .patch(`/admin/coupons/${testCouponId}`)
            .set('Cookie', adminCookie)
            .set('Accept', 'application/json')
            .send({
                value: 25
            });

        expect(res.status).toBe(200);
        
        const updated = await Coupon.findById(testCouponId);
        expect(updated.value).toBe(25);
    });
});
