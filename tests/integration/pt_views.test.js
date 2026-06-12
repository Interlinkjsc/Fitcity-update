const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('PT Views Integration', () => {
    let ptCookie;
    let branchId;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const { hash } = require('../../src/utils/encryption');
        await User.deleteMany({ emailHash: { $in: [hash('pt_views_test@fitcity.com')] } });
        await Branch.deleteMany({ name: 'Branch_PT_VIEWS' });

        const branch = await Branch.create({
            name: 'Branch_PT_VIEWS',
            address: 'Test address',
            phone: '0900000000',
            status: 'Open'
        });
        branchId = branch._id;

        await User.create({
            name: 'PT Views',
            email: 'pt_views_test@fitcity.com',
            password: 'password123',
            role: 'PT',
            status: 'Active',
            branch: branchId
        });

        const loginRes = await request(app)
            .post('/auth/login')
            .send({ email: 'pt_views_test@fitcity.com', password: 'password123' });
        ptCookie = loginRes.headers['set-cookie'];
    });

    afterAll(async () => {
        const { hash } = require('../../src/utils/encryption');
        await User.deleteMany({ emailHash: { $in: [hash('pt_views_test@fitcity.com')] } });
        await Branch.deleteMany({ _id: branchId });
        await mongoose.connection.close();
    });

    it('Should render PT clients page', async () => {
        const res = await request(app)
            .get('/pt/clients')
            .set('Cookie', ptCookie);

        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Khách hàng của tôi');
    });

    it('Should render PT schedule page', async () => {
        const res = await request(app)
            .get('/pt/schedule')
            .set('Cookie', ptCookie);

        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Lịch Dạy');
    });

    it('Should render PT slots page', async () => {
        const res = await request(app)
            .get('/pt/slots')
            .set('Cookie', ptCookie);

        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Slot mở sẵn');
    });

    it('Should render PT requests page', async () => {
        const res = await request(app)
            .get('/pt/requests')
            .set('Cookie', ptCookie);

        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('Yêu cầu');
    });
});
