const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const User = require('../../src/modules/users/models/userModel.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

describe('Branch Controller (CRUD) Integration', () => {

    let adminCookie;
    let managerUser;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        
        await Branch.deleteMany({ name: /^TEST_BR_/ });
        await User.deleteMany({ email: /^admin_br@|^mgr_br@/ });
        
        // Tạo User Admin để mock Phiên đăng nhập
        await User.create({
            name: 'Admin Branch',
            email: 'admin_br@fitcity.com',
            password: '123456',
            role: 'Admin',
            status: 'Active'
        });

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'admin_br@fitcity.com', password: '123456' });
        adminCookie = res.headers['set-cookie'];

        // Tạo 1 Manager để test tính năng Phân bổ Manager vào form Branch
        managerUser = await User.create({
            name: 'Mgr Branch',
            email: 'mgr_br@fitcity.com',
            password: '123456',
            role: 'Manager',
            status: 'Active',
            branch: new mongoose.Types.ObjectId() // Bypass Validation User
        });
    });

    afterAll(async () => {
        await Branch.deleteMany({ name: /^TEST_BR_/ });
        await User.deleteMany({ email: /^admin_br@|^mgr_br@/ });
        await mongoose.connection.close();
    });

    describe('GET /admin/branches/list', () => {
        it('Should render the branches list view', async () => {
            const res = await request(app).get('/admin/branches/list').set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Cơ sở / Chi nhánh');
        });
    });

    describe('GET /admin/branches/create', () => {
        it('Should render the creation form and include Manager list', async () => {
            const res = await request(app).get('/admin/branches/create').set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Thiết lập Chi nhánh mới');
            expect(res.text).toContain('Mgr Branch'); // Tên ông Manager phải xuất hiện ở thẻ option
        });
    });

    describe('POST /admin/branches/store', () => {
        it('Should create a new branch and redirect', async () => {
            const res = await request(app)
                .post('/admin/branches/store')
                .set('Cookie', adminCookie)
                .send({
                    name: 'TEST_BR_1',
                    address: '123 Vo Van Tan, Q3',
                    phone: '0901234567',
                    manager: managerUser._id
                });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/branches/list');
            
            const br = await Branch.findOne({ name: 'TEST_BR_1' });
            expect(br).not.toBeNull();
            expect(br.address).toBe('123 Vo Van Tan, Q3');
        });

        it('Should redirect back to form if branch name is duplicated', async () => {
            const res = await request(app)
                .post('/admin/branches/store')
                .set('Cookie', adminCookie)
                .send({ name: 'TEST_BR_1', address: 'KhacDiaChi', phone: '0901234567' });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/branches/create');
        });

        it('Should redirect back to form with validation errors (missing address)', async () => {
            const res = await request(app)
                .post('/admin/branches/store')
                .set('Cookie', adminCookie)
                .send({ name: 'TEST_BR_FAIL', phone: '0901234567' }); // missing required address
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/branches/create');
        });
    });

    describe('GET /admin/branches/edit/:id', () => {
        it('Should render edit form and populate correct data', async () => {
            const br = await Branch.create({ name: 'TEST_BR_2', address: 'XYZ', phone: '0901234567' });
            const res = await request(app).get(`/admin/branches/edit/${br._id}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('Cập nhật');
            expect(res.text).toContain('TEST_BR_2');
        });

        it('Should redirect if branch id not found', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app).get(`/admin/branches/edit/${fakeId}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/branches/list');
        });
    });

    describe('POST /admin/branches/update/:id', () => {
        it('Should update branch successfully and redirect', async () => {
            const br = await Branch.create({ name: 'TEST_BR_3', address: 'XXX', phone: '0901234567' });
            const res = await request(app)
                .post(`/admin/branches/update/${br._id}`)
                .set('Cookie', adminCookie)
                .send({ name: 'TEST_BR_3_UPDATED', address: 'XXX', phone: '0901234567' });
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/branches/list');

            const updated = await Branch.findById(br._id);
            expect(updated.name).toBe('TEST_BR_3_UPDATED');
        });

        it('Should fail when renaming to an existing branch name', async () => {
            const br1 = await Branch.create({ name: 'TEST_BR_4', address: 'XXX', phone: '0901234567' });
            const br2 = await Branch.create({ name: 'TEST_BR_5', address: 'YYY', phone: '0909999999' });
            
            // Cố ý đổi tên chi nhánh số 5 thành tên chi nhánh số 4
            const res = await request(app)
                .post(`/admin/branches/update/${br2._id}`)
                .set('Cookie', adminCookie)
                .send({ name: 'TEST_BR_4', address: 'YYY', phone: '0909999999' });
                
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe(`/admin/branches/edit/${br2._id}`);
        });
    });

    describe('POST /admin/branches/delete/:id', () => {
        it('Should prevent deletion if there is active staff linked to branch', async () => {
            const br = await Branch.create({ name: 'TEST_BR_HAS_STAFF', address: 'XXX', phone: '0901234567' });
            // Tạo 1 nhân viên giả thuộc branch này
            await User.create({
                name: 'Staff in Branch',
                email: 'staff_br@fitcity.com',
                password: 'password123',
                role: 'PT',
                status: 'Active',
                branch: br._id
            });

            const res = await request(app).post(`/admin/branches/delete/${br._id}`).set('Cookie', adminCookie);
            
            // Phải bị đẩy về trang danh sách với lỗi (Mô phỏng redirect)
            expect(res.statusCode).toBe(302);
            expect(res.header.location).toBe('/admin/branches/list');
            
            // Xoá DB giả sau test
            await User.deleteMany({ email: 'staff_br@fitcity.com' });
        });

        it('Should delete successfully if branch is empty', async () => {
            const emptyBr = await Branch.create({ name: 'TEST_BR_EMPTY', address: 'A', phone: '0912222333' });
            const res = await request(app).post(`/admin/branches/delete/${emptyBr._id}`).set('Cookie', adminCookie);
            expect(res.statusCode).toBe(302);
            
            const check = await Branch.findById(emptyBr._id);
            expect(check).toBeNull();
        });
    });
});
