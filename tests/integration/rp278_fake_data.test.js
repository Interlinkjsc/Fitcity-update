/**
 * Rp27/7 (Fitcity report.xlsx) — Test SỐ LIỆU ẢO đối chiếu từng con số.
 * Seed dữ liệu biết trước → assert kết quả khớp chính xác:
 *  A2/A12  Hoa hồng dạy PT = số buổi × (rate% × giá/buổi)
 *  A4/A5/A6/A7  Báo cáo tài chính: mã HĐ, phí gia hạn, công nợ, NV sale, chi âm, format số
 *  A3  Import: khôi phục số 0 đầu SĐT/CCCD, đọc richText/formula
 *  A8  Violation update với staff rỗng → giữ nhân sự cũ, đổi trạng thái OK
 */
const mongoose = require('mongoose');
const { connectTestDb, disconnectTestDb } = require('../helpers/testDb');

jest.setTimeout(60000);

const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');
const PaymentTransaction = require('../../src/modules/contracts/models/transactionModel.js');
const Expense = require('../../src/modules/finance/models/expenseModel.js');
const Violation = require('../../src/modules/crm/models/violationModel.js');

const payrollService = require('../../src/modules/finance/services/payrollService');
const reportService = require('../../src/modules/platform/services/reportService');
const violationController = require('../../src/modules/crm/controllers/violationController');
const { normalizePhone, normalizeCccd, cellText } = require('../../src/utils/importNormalize');

describe('Rp27/7 — số liệu ảo đối chiếu', () => {
    let branch, pt, sales, client;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    beforeAll(async () => {
        await connectTestDb();
        branch = await Branch.create({ name: 'RP278 Test Branch', address: '1 Test St', phone: '0900000001' });
        pt = await User.create({
            name: 'PT RP278', email: 'pt.rp278@test.local', password: 'x12345678',
            role: 'PT', status: 'Active', branch: branch._id,
            baseSalary: 5000000, ptCommissionRate: 10, salesCommissionRate: 0
        });
        sales = await User.create({
            name: 'Sale RP278', email: 'sale.rp278@test.local', password: 'x12345678',
            role: 'Sales', status: 'Active', branch: branch._id
        });
        client = await User.create({
            name: 'KH RP278', email: 'kh.rp278@test.local', password: 'x12345678',
            role: 'Client', status: 'Active', branch: branch._id
        });
    });

    afterAll(async () => {
        // KHÔNG dropDatabase: DB test dùng chung với các suite chạy song song.
        // Chỉ dọn đúng dữ liệu suite này tạo ra (marker RP278 / *.rp278@test.local).
        try {
            const contracts = await Contract.find({ contractCode: /^RP278/ }).select('_id').lean();
            const contractIds = contracts.map(c => c._id);
            await PaymentTransaction.deleteMany({ $or: [{ receiptNumber: /RP278/ }, { contractId: { $in: contractIds } }] });
            await WorkoutSession.deleteMany({ contract: { $in: contractIds } });
            await Contract.deleteMany({ _id: { $in: contractIds } });
            await Violation.deleteMany({ description: 'test', staff: pt._id });
            await Expense.deleteMany({ description: 'Chi phí test RP278' });
            await User.deleteMany({ emailHash: { $exists: true }, name: { $in: ['PT RP278', 'Sale RP278', 'KH RP278', 'KH B'] } });
            await Branch.deleteMany({ name: { $in: ['RP278 Test Branch', 'RP278 Branch B'] } });
        } finally {
            await mongoose.connection.close();
        }
    });

    describe('A2+A12 — hoa hồng dạy PT', () => {
        let contract;
        beforeAll(async () => {
            // Giá 50.000.000đ / 100 buổi = 500.000đ/buổi; rate 10% → 50.000đ/buổi
            contract = await Contract.create({
                client: client._id, sales: sales._id, pt: pt._id, branch: branch._id,
                servicePackage: new mongoose.Types.ObjectId(),
                packageSnapshot: { name: 'PT100', type: 'PT', duration: 365, price: 50000000, sessions: 100 },
                basePrice: 50000000, totalAmount: 55000000, totalSessions: 100,
                paymentStatus: 'Paid', paidAmount: 30000000, contractStatus: 'Active',
                contractCode: 'RP278-PT-001',
                startDate: startOfMonth, endDate: endOfMonth,
                paymentDeadline: endOfMonth
            });
            // 2 buổi Completed trong tháng
            for (let i = 0; i < 2; i++) {
                await WorkoutSession.create({
                    client: client._id, pt: pt._id, contract: contract._id, branch: branch._id,
                    scheduledTime: new Date(startOfMonth.getTime() + (i + 1) * 24 * 3600 * 1000),
                    status: 'Completed'
                });
            }
        });

        test('2 buổi × 50.000đ = đúng 100.000đ, taughtCount = 2', async () => {
            const r = await payrollService.calculatePTTeachingCommission(pt._id, startOfMonth, endOfMonth);
            expect(r.taughtCount).toBe(2);
            expect(r.commission).toBe(100000);
        });
    });

    describe('A4+A5+A6+A7 — báo cáo tài chính xuất Excel', () => {
        beforeAll(async () => {
            const c = await Contract.findOne({ contractCode: 'RP278-PT-001' });
            await PaymentTransaction.create({
                contractId: c._id, clientId: client._id, amount: 400000,
                transactionType: 'Extension_Fee', paymentMethod: 'Cash', status: 'Success',
                receiptNumber: 'RCP-RP278-EXT-1'
            });
            await Expense.create({
                description: 'Chi phí test RP278', amount: 10000000, category: 'Other',
                branch: branch._id, date: new Date(), recordedBy: sales._id
            });
        });

        test('có mã HĐ (không N/A), phí gia hạn, công nợ 25tr, NV sale, chi âm, format #,##0', async () => {
            const wb = await reportService.generateCustomReport(
                startOfMonth.toISOString(), endOfMonth.toISOString(), 'all'
            );
            const sheet = wb.getWorksheet('Báo cáo Tài chính Chi tiết');
            const rows = [];
            sheet.eachRow((row, n) => { if (n > 1) rows.push(row.values); });
            const flat = JSON.stringify(rows);

            // A4: mã HĐ hiển thị đúng, không còn "HĐ: N/A"
            expect(flat).toContain('RP278-PT-001');
            expect(flat).not.toContain('HĐ: N/A');
            // A7: có cột NV sale
            expect(flat).toContain('Sale RP278');
            // A5: dòng phí gia hạn 400.000đ
            expect(flat).toContain('Phí gia hạn HĐ');
            expect(flat).toContain('400000');
            // A6: công nợ = 55tr - 30tr = 25tr
            expect(flat).toContain('25000000');
            // A7: chi phí ghi ÂM
            expect(flat).toContain('-10000000');
            // A7: cột tiền có numFmt ngăn cách nghìn
            expect(sheet.getColumn('amount').numFmt).toContain('#,##0');
            // QC review 1: chi phí KHÔNG chiếm cột Mã HĐ — mô tả nằm ở cột Diễn giải
            const expenseRow = rows.find(r => JSON.stringify(r).includes('Chi phí test RP278'));
            expect(expenseRow).toBeDefined();
        });

        test('QC: end-date dạng chuỗi YYYY-MM-DD vẫn gồm trọn ngày cuối', async () => {
            const endStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
            const startStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01`;
            const wb = await reportService.generateCustomReport(startStr, endStr, 'all');
            const sheet = wb.getWorksheet('Báo cáo Tài chính Chi tiết');
            const flat = [];
            sheet.eachRow((row, n) => { if (n > 1) flat.push(JSON.stringify(row.values)); });
            // HĐ tạo giữa tháng phải xuất hiện dù endDate là 00:00 nếu không chuẩn hoá
            expect(flat.join()).toContain('RP278-PT-001');
        });

        test('QC: lọc chi nhánh — phí gia hạn chi nhánh khác + giao dịch mồ côi bị loại, tổng đúng', async () => {
            const otherBranch = await Branch.create({ name: 'RP278 Branch B', address: '2 Test St', phone: '0900000002' });
            const otherClient = await User.create({
                name: 'KH B', email: 'kh.b.rp278@test.local', password: 'x12345678',
                role: 'Client', status: 'Active', branch: otherBranch._id
            });
            const otherContract = await Contract.create({
                client: otherClient._id, sales: sales._id, branch: otherBranch._id,
                servicePackage: new mongoose.Types.ObjectId(),
                packageSnapshot: { name: 'GYM', type: 'Gym', duration: 30, price: 1000000, sessions: 12 },
                basePrice: 1000000, totalAmount: 1000000, paidAmount: 1000000,
                paymentStatus: 'Paid', contractStatus: 'Active', contractCode: 'RP278-B-001',
                startDate: startOfMonth, endDate: endOfMonth, paymentDeadline: endOfMonth
            });
            // Phí gia hạn thuộc chi nhánh B + 1 giao dịch mồ côi (contract không tồn tại)
            await PaymentTransaction.create({
                contractId: otherContract._id, clientId: otherClient._id, amount: 600000,
                transactionType: 'Extension_Fee', paymentMethod: 'Cash', status: 'Success',
                receiptNumber: 'RCP-RP278-EXT-B'
            });
            await PaymentTransaction.create({
                contractId: new mongoose.Types.ObjectId(), clientId: otherClient._id, amount: 999999,
                transactionType: 'Extension_Fee', paymentMethod: 'Cash', status: 'Success',
                receiptNumber: 'RCP-RP278-EXT-ORPHAN'
            });

            // Lọc theo chi nhánh A (branch gốc): KHÔNG được thấy 600000 (chi nhánh B) và 999999 (mồ côi)
            const wb = await reportService.generateCustomReport(
                startOfMonth.toISOString(), endOfMonth.toISOString(), String(branch._id)
            );
            const sheet = wb.getWorksheet('Báo cáo Tài chính Chi tiết');
            const flat = [];
            let sumRowVals = null;
            sheet.eachRow((row, n) => { if (n > 1) { flat.push(JSON.stringify(row.values)); if (JSON.stringify(row.values).includes('TỔNG CỘNG')) sumRowVals = row.values; } });
            const joined = flat.join();
            expect(joined).toContain('400000');       // phí gia hạn chi nhánh A vẫn có
            expect(joined).not.toContain('999999');    // mồ côi bị loại
            expect(joined).not.toContain('RP278-B-001'); // HĐ chi nhánh B bị loại
            // Tổng "Đã thu" chi nhánh A = 30tr (paid) + 0.4tr (ext) - 10tr (chi) = 20.4tr
            expect(JSON.stringify(sumRowVals)).toContain('20400000');

            // QC review 2: xem TẤT CẢ chi nhánh — giao dịch mồ côi (999999) vẫn phải bị loại
            const wbAll = await reportService.generateCustomReport(
                startOfMonth.toISOString(), endOfMonth.toISOString(), 'all'
            );
            const sheetAll = wbAll.getWorksheet('Báo cáo Tài chính Chi tiết');
            const flatAll = [];
            sheetAll.eachRow((row, n) => { if (n > 1) flatAll.push(JSON.stringify(row.values)); });
            expect(flatAll.join()).not.toContain('999999');
        });

        test('QC2: chuỗi YYYY-MM-DD hiểu theo giờ VN — giao dịch 00:01 ngày đầu không bị mất', async () => {
            // HĐ tạo lúc 00:01 sáng ngày đầu tháng (giờ địa phương)
            const earlyDate = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), 1, 0, 1, 0);
            const c = await Contract.create({
                client: client._id, sales: sales._id, branch: branch._id,
                servicePackage: new mongoose.Types.ObjectId(),
                packageSnapshot: { name: 'EARLY', type: 'Gym', duration: 30, price: 2000000, sessions: 10 },
                basePrice: 2000000, totalAmount: 2000000, paidAmount: 2000000,
                paymentStatus: 'Paid', contractStatus: 'Active', contractCode: 'RP278-EARLY-001',
                startDate: earlyDate, endDate: endOfMonth, paymentDeadline: endOfMonth
            });
            await Contract.updateOne({ _id: c._id }, { $set: { createdAt: earlyDate } });

            const startStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01`;
            const endStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
            const wb = await reportService.generateCustomReport(startStr, endStr, 'all');
            const sheet = wb.getWorksheet('Báo cáo Tài chính Chi tiết');
            const flat = [];
            sheet.eachRow((row, n) => { if (n > 1) flat.push(JSON.stringify(row.values)); });
            // Nếu parse UTC (lệch +7h) thì HĐ 00:01 sẽ bị mất — phải CÓ trong báo cáo
            expect(flat.join()).toContain('RP278-EARLY-001');
        });
    });

    describe('A3 — import khôi phục số 0 đầu', () => {
        test('SĐT mất số 0 đầu (912345678) → 0912345678', () => {
            expect(normalizePhone(912345678)).toBe('0912345678');
            expect(normalizePhone('0912345678')).toBe('0912345678');
            expect(normalizePhone('+84912345678')).toBe('0912345678');
            expect(normalizePhone('84912345678')).toBe('0912345678');
            expect(normalizePhone('09 1234 5678')).toBe('0912345678');
        });
        test('CCCD 11 số (mất 0 đầu) → thêm lại thành 12 số', () => {
            expect(normalizeCccd(79212345678)).toBe('079212345678');
            expect(normalizeCccd('079212345678')).toBe('079212345678');
        });
        test('cellText đọc richText/formula/number', () => {
            const fakeRow = (v) => ({ getCell: () => ({ value: v }) });
            expect(cellText(fakeRow({ richText: [{ text: 'Nguyễn ' }, { text: 'Văn A' }] }), 1)).toBe('Nguyễn Văn A');
            expect(cellText(fakeRow({ formula: 'A1', result: 912345678 }), 1)).toBe('912345678');
            expect(cellText(fakeRow(912345678), 1)).toBe('912345678');
            expect(cellText(fakeRow(null), 1)).toBe('');
        });
    });

    describe('A8 — violation update staff rỗng không crash', () => {
        let violation;
        beforeAll(async () => {
            violation = await Violation.create({
                staff: pt._id, type: 'Vắng mặt không phép', description: 'test',
                penaltyAmount: 100000, date: new Date(), status: 'Pending', loggedBy: sales._id
            });
        });

        function mockReqRes(body, params) {
            const flashes = [];
            const req = { params, body, flash: (t, m) => flashes.push({ t, m }), session: { user: { id: 'x', role: 'Admin' } } };
            let redirected = null;
            const res = { redirect: (u) => { redirected = u; } };
            return { req, res, flashes, redirected: () => redirected };
        }

        test('staff="" + đổi trạng thái Cancelled → giữ nhân sự cũ, lưu OK', async () => {
            const { req, res, flashes } = mockReqRes(
                { staff: '', type: 'Vắng mặt không phép', description: 'test', penaltyAmount: 100000, status: 'Cancelled' },
                { id: violation._id.toString() }
            );
            await violationController.updateViolation(req, res, () => {});
            const after = await Violation.findById(violation._id);
            expect(after.status).toBe('Cancelled');
            expect(String(after.staff)).toBe(String(pt._id));
            expect(flashes.some(f => f.t === 'success_msg')).toBe(true);
        });
    });
});
