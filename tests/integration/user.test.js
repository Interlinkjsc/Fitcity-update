const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('HR / User Controller (CRUD) Integration', () => {

    let adminCookie;
    let testBranchId;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        
        const { hash } = require('../../src/utils/encryption');
        await User.deleteMany({ 
            emailHash: { 
                $in: [
                    hash('admin_hr_1@fitcity.com'),
                    hash('test_hr_pt1@fitcity.com'),
                    hash('test_hr_edit1@fitcity.com'),
                    hash('test_hr_upd1@fitcity.com'),
                    hash('test_hr_a@fitcity.com'),
                    hash('test_hr_b@fitcity.com'),
                    hash('test_hr_valfail@fitcity.com'),
                    hash('test_hr_todelete@fitcity.com')
                ] 
            } 
        });
        await Branch.deleteMany({ name: /^Branch_For_HR_/ });
        
        // Tạo Branch mock
        const br = await Branch.create({ name: 'Branch_For_HR_1', address: '123', phone: '0901234567' });
        testBranchId = br._id;

        // Tạo Admin mock
        await User.create({
            name: 'Admin HR',
            email: 'admin_hr_1@fitcity.com',
            password: 'password123',
            role: 'Admin',
            status: 'Active'
        });

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'admin_hr_1@fitcity.com', password: 'password123' });
        adminCookie = res.headers['set-cookie'];
    });

    afterAll(async () => {
        await User.deleteMany({ email: /^test_hr_|^admin_hr_/ });
        await Branch.deleteMany({ name: /^Branch_For_HR_/ });
        await mongoose.connection.close();
    });

    describe('GET /admin/users/list', () => {
        it('Should render the users (staff) list page', async () => {
            const res = await request(app).get('/admin/users/list').set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Quản lý Tài Khoản & Nhân Sự');
        });
    });

    describe('GET /admin/users/create', () => {
        it('Should render the user creation form and pass branches', async () => {
            const res = await request(app).get('/admin/users/create').set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Đăng ký Nhân sự mới');
            expect(res.text).toContain('Branch_For_HR_1');
        });
    });

    describe('POST /admin/users/store', () => {
        it('Should create a new staff and redirect to list', async () => {
            const res = await request(app)
                .post('/admin/users/store')
                .set('Cookie', adminCookie)
                .send({
                    name: 'TEST HR PT',
                    email: 'test_hr_pt1@fitcity.com',
                    password: 'password123',
                    phone: '0901234567',
                    role: 'PT',
                    branch: testBranchId
                });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/users/list');
            
            const { hash } = require('../../src/utils/encryption');
            const pUser = await User.findOne({ emailHash: hash('test_hr_pt1@fitcity.com') });
            expect(pUser).not.toBeNull();
            expect(pUser.name).toBe('TEST HR PT');
            expect(pUser.role).toBe('PT');
        });

        it('Should reject and redirect to form if email exists', async () => {
            // Dùng lại email cũ
            const res = await request(app)
                .post('/admin/users/store')
                .set('Cookie', adminCookie)
                .send({
                    name: 'Duplicate',
                    email: 'test_hr_pt1@fitcity.com',
                    password: 'password123',
                    phone: '0901234567',
                    role: 'PT',
                    branch: testBranchId
                });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/users/create');
        });

        it('Should redirect to form with validation errors when missing mandatory fields', async () => {
            const res = await request(app)
                .post('/admin/users/store')
                .set('Cookie', adminCookie)
                .send({
                    email: 'test_hr_fail@fitcity.com',
                    password: '123' // Quá ngắn
                });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/users/create');
        });
    });

    describe('GET /admin/users/edit/:id', () => {
        it('Should render edit form', async () => {
            const dummy = await User.create({
                name: 'TEST HR EDIT',
                email: 'test_hr_edit1@fitcity.com',
                password: 'password123',
                role: 'PT',
                branch: testBranchId
            });
            const res = await request(app).get(`/admin/users/edit/${dummy._id}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Điều chỉnh Hồ sơ Nhân viên');
            expect(res.text).toContain('TEST HR EDIT');
        });

        it('Should redirect to list if incorrect user ID', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).get(`/admin/users/edit/${fakeId}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/users/list');
        });
    });

    describe('POST /admin/users/update/:id', () => {
        it('Should update user details without updating password if pass is empty', async () => {
            const dummy = await User.create({
                name: 'TEST HR UPDATE NAME',
                email: 'test_hr_upd1@fitcity.com',
                password: 'password123',
                role: 'PT',
                branch: testBranchId
            });
            const res = await request(app)
                .post(`/admin/users/update/${dummy._id}`)
                .set('Cookie', adminCookie)
                .send({
                    name: 'UPDATED HR PT NAME',
                    email: 'test_hr_upd1@fitcity.com', // Cùng email gốc, pass trống
                    password: '', 
                    role: 'PT',
                    branch: testBranchId
                });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/users/list');

            const updated = await User.findById(dummy._id);
            expect(updated.name).toBe('UPDATED HR PT NAME');
            
            // Validate password hasn't changed (Should still be able to login logic technically, but here we just check name)
        });

        it('Should reject update if new email belongs to someone else', async () => {
            const userA = await User.create({ name: 'A', email: 'test_hr_a@fitcity.com', password: 'password123', role: 'PT', branch: testBranchId});
            const userB = await User.create({ name: 'B', email: 'test_hr_b@fitcity.com', password: 'password123', role: 'PT', branch: testBranchId});

            const res = await request(app)
                .post(`/admin/users/update/${userB._id}`)
                .set('Cookie', adminCookie)
                .send({ email: 'test_hr_a@fitcity.com' }); // Trùng với A

            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe(`/admin/users/edit/${userB._id}`);
        });

        it('Should handle validation error (e.g. invalid phone/role format)', async () => {
            const dummy = await User.create({
                name: 'TEST HR VALIDATION FAIL',
                email: 'test_hr_valfail@fitcity.com',
                password: 'password123',
                role: 'PT',
                branch: testBranchId
            });
            const res = await request(app)
                .post(`/admin/users/update/${dummy._id}`)
                .set('Cookie', adminCookie)
                .send({ role: 'HackerRole', phone: '111' }); // Role & Phone sai format
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe(`/admin/users/edit/${dummy._id}`);
        });

        it('Should redirect to list when update fake id', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).post(`/admin/users/update/${fakeId}`).set('Cookie', adminCookie).send();
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/users/list');
        });
    });

    describe('POST /admin/users/delete/:id', () => {
        it('Should soft/hard delete user and redirect', async () => {
            const dummy = await User.create({
                name: 'TO BE DELETED',
                email: 'test_hr_todelete@fitcity.com',
                password: 'password123',
                role: 'PT',
                branch: testBranchId
            });
            const res = await request(app).post(`/admin/users/delete/${dummy._id}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/users/list');
            
            const check = await User.findById(dummy._id);
            expect(check).toBeNull();
        });

        it('Should redirect if trying to delete nonexistent', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).post(`/admin/users/delete/${fakeId}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(302);
        });
    });
});
