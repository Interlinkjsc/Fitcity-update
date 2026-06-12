const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');

let mongoServer;
let clientCookie;
let clientUser;
let ptUser;
let testBranch;
let testContract;

beforeAll(async () => {
    jest.setTimeout(60000);
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // 0. Tạo Branch
    testBranch = await Branch.create({
        name: 'Chi nhánh Test',
        address: '123 Test St',
        phone: '0123456789',
        status: 'Open'
    });

    // 1. Tạo PT
    ptUser = await User.create({
        name: 'Test PT',
        email: 'pt_calendar@fitcity.com',
        password: 'Password123!',
        role: 'PT',
        phone: '0988000111',
        branch: testBranch._id
    });

    // 2. Tạo Client
    clientUser = await User.create({
        name: 'Test Client',
        email: 'client_calendar@fitcity.com',
        password: 'Password123!',
        role: 'Client',
        phone: '0988000222',
        branch: testBranch._id
    });

    // 2.5 Tạo Contract
    testContract = await Contract.create({
        contractNumber: 'HD-TEST-123',
        client: clientUser._id,
        pt: ptUser._id,
        branch: testBranch._id,
        sales: ptUser._id,
        servicePackage: new mongoose.Types.ObjectId(),
        totalSessions: 10,
        startDate: new Date(),
        endDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000),
        contractStatus: 'Active',
        basePrice: 5000000,
        discount: 0,
        netAmount: 5000000,
        totalAmount: 5000000,
        paymentStatus: 'Paid',
        packageSnapshot: {
            name: 'Gói Test Calendar',
            price: 5000000,
            duration: 30
        }
    });

    // 3. Login Client để lấy Cookie
    const res = await request(app)
        .post('/auth/login')
        .send({
            email: 'client_calendar@fitcity.com',
            password: 'Password123!'
        });
    clientCookie = res.headers['set-cookie'];
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await WorkoutSession.deleteMany({});
});

describe('Calendar & Session Management (TDD)', () => {
    let futureSession;
    let nearSession;

    beforeEach(async () => {
        const now = new Date();
        
        // Buổi tập ở tương lai xa (cách 3 ngày)
        const futureDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        futureSession = await WorkoutSession.create({
            client: clientUser._id,
            pt: ptUser._id,
            contract: testContract._id,
            branch: testBranch._id,
            scheduledTime: futureDate,
            startTime: futureDate,
            endTime: new Date(futureDate.getTime() + 60 * 60 * 1000),
            status: 'Scheduled',
            notes: 'Buổi tập 1'
        });

        // Buổi tập gần (cách 10 tiếng - NHỎ HƠN 24H)
        const nearDate = new Date(now.getTime() + 10 * 60 * 60 * 1000);
        nearSession = await WorkoutSession.create({
            client: clientUser._id,
            pt: ptUser._id,
            contract: testContract._id,
            branch: testBranch._id,
            scheduledTime: nearDate,
            startTime: nearDate,
            endTime: new Date(nearDate.getTime() + 60 * 60 * 1000),
            status: 'Scheduled',
            notes: 'Buổi tập 2'
        });
    });

    describe('1. GET /api/calendar/sessions', () => {
        it('Phải trả về danh sách lịch tập định dạng FullCalendar chuẩn', async () => {
            const res = await request(app)
                .get('/api/calendar/sessions')
                .set('Cookie', clientCookie);

            expect(res.status).toBe(200);
            // Controller trả về plain array cho FullCalendar JSON feed (xem comment trong getSessions)
            expect(Array.isArray(res.body)).toBe(true);
            
            // Format FullCalendar bắt buộc phải có title, start, end
            const event = res.body.find(e => e.id === futureSession._id.toString());
            expect(event).toBeDefined();
            expect(event.title).toBeDefined();
            expect(event.start).toBeDefined();
            expect(event.end).toBeDefined();
        });
    });

    describe('2. Logic Hủy Lịch (Cancel Rule)', () => {
        it('NÊN cho phép hủy buổi tập cách hiện tại hơn 24 giờ', async () => {
            const res = await request(app)
                .patch(`/api/calendar/sessions/${futureSession._id}/cancel`)
                .set('Cookie', clientCookie);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');

            const updatedSession = await WorkoutSession.findById(futureSession._id);
            expect(updatedSession.status).toBe('Cancelled');
        });

        it('KHÔNG ĐƯỢC cho phép hủy buổi tập cách hiện tại dưới 24 giờ', async () => {
            const res = await request(app)
                .patch(`/api/calendar/sessions/${nearSession._id}/cancel`)
                .set('Cookie', clientCookie);

            expect(res.status).toBe(400); // Bad Request (Vi phạm rule)
            expect(res.body.message).toMatch(/24/i); // Thông báo lỗi phải chứa chữ 24(giờ)

            const updatedSession = await WorkoutSession.findById(nearSession._id);
            expect(updatedSession.status).toBe('Scheduled'); // Trạng thái phải được giữ nguyên
        });
    });
});
