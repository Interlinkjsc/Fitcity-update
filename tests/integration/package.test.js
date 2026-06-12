const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const ServicePackage = require('../../src/modules/programs/models/servicePackageModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('Service Package Controller (CRUD) Integration', () => {

    let adminCookie;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        
        await ServicePackage.deleteMany({ name: /^TEST_PKG_/ });
        
        // Tạo một Admin user để login lấy session Cookie gác cổng
        await User.deleteMany({ email: 'admin_pkg@fitcity.com' });
        await User.create({
            name: 'Admin Pkg',
            email: 'admin_pkg@fitcity.com',
            password: '123456',
            role: 'Admin',
            status: 'Active'
        });

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'admin_pkg@fitcity.com', password: '123456' });
        adminCookie = res.headers['set-cookie'];
    });

    afterAll(async () => {
        await ServicePackage.deleteMany({ name: /^TEST_PKG_/ });
        await User.deleteMany({ email: 'admin_pkg@fitcity.com' });
        await mongoose.connection.close();
    });

    describe('GET /admin/packages/list', () => {
        it('Should render the packages list page', async () => {
            const res = await request(app).get('/admin/packages/list').set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Danh sách Gói tập');
        });
    });

    describe('GET /admin/packages/create', () => {
        it('Should render the creation form', async () => {
            const res = await request(app).get('/admin/packages/create').set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Tạo mới');
        });
    });

    describe('POST /admin/packages/store', () => {
        it('Should create a new package and redirect', async () => {
            const res = await request(app)
                .post('/admin/packages/store')
                .set('Cookie', adminCookie)
                .send({
                    name: 'TEST_PKG_1',
                    type: 'Gym',
                    price: 1500000,
                    duration: 30,
                    sessions: 30,
                    description: 'Basic Package'
                });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/packages/list');
            
            const pkg = await ServicePackage.findOne({ name: 'TEST_PKG_1' });
            expect(pkg).not.toBeNull();
            expect(pkg.price).toBe(1500000);
        });

        it('Should redirect to form if validation fails (e.g. negative price)', async () => {
            const res = await request(app)
                .post('/admin/packages/store')
                .set('Cookie', adminCookie)
                .send({
                    name: 'TEST_PKG_FAIL',
                    type: 'Gym',
                    price: -100, // Invalid
                    duration: 30
                });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/packages/create');
        });
    });

    describe('GET /admin/packages/edit/:id', () => {
        it('Should render edit form for existing package', async () => {
            const pkg = await ServicePackage.create({ name: 'TEST_PKG_2', type: 'Gym', duration: 30, price: 1000 });
            const res = await request(app).get(`/admin/packages/edit/${pkg._id}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Cập nhật');
            expect(res.text).toContain('TEST_PKG_2');
        });

        it('Should redirect to list if package not found', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).get(`/admin/packages/edit/${fakeId}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/packages/list');
        });
    });

    describe('POST /admin/packages/update/:id', () => {
        it('Should update package and redirect', async () => {
            const pkg = await ServicePackage.create({ name: 'TEST_PKG_3', type: 'Gym', duration: 30, price: 2000 });
            const res = await request(app)
                .post(`/admin/packages/update/${pkg._id}`)
                .set('Cookie', adminCookie)
                .send({ name: 'TEST_PKG_UPDATED', type: 'Gym', duration: 40, price: 5000 });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/packages/list');

            const updated = await ServicePackage.findById(pkg._id);
            expect(updated.name).toBe('TEST_PKG_UPDATED');
            expect(updated.price).toBe(5000);
        });

        it('Should redirect to form if update validation fails', async () => {
            const pkg = await ServicePackage.create({ name: 'TEST_PKG_4', type: 'Gym', duration: 30, price: 100 });
            const res = await request(app)
                .post(`/admin/packages/update/${pkg._id}`)
                .set('Cookie', adminCookie)
                .send({ duration: 0 }); // Invalid duration
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe(`/admin/packages/edit/${pkg._id}`);
        });

        it('Should redirect to list when updating non-existent package', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/admin/packages/update/${fakeId}`)
                .set('Cookie', adminCookie)
                .send({ name: 'Valid Name', type: 'Gym', duration: 10, price: 1 });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/packages/list');
        });
    });

    describe('POST /admin/packages/delete/:id', () => {
        it('Should delete package and redirect', async () => {
            const pkg = await ServicePackage.create({ name: 'TEST_PKG_TO_DELETE', type: 'Gym', duration: 30, price: 10 });
            const res = await request(app).post(`/admin/packages/delete/${pkg._id}`).set('Cookie', adminCookie).send();
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/packages/list');
            
            const found = await ServicePackage.findById(pkg._id);
            expect(found).toBeNull();
        });

        it('Should still redirect if trying to delete non-existent package', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).post(`/admin/packages/delete/${fakeId}`).set('Cookie', adminCookie).send();
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/packages/list');
        });
    });
});
