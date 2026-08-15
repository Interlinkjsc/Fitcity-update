/**
 * Rp 15/8 (158.xlsx) — TEST SỐ LIỆU ẢO cho COMMISSION ENGINE dùng chung + payroll refresh + export + import + macros.
 * Mọi con số seed biết trước → assert khớp CHÍNH XÁC. Không dropDatabase (DB test dùng chung) — dọn theo marker I158.
 *
 * Test matrix (theo yêu cầu):
 *  - PT: session Completed/Confirmed vs Scheduled/Cancelled; sát boundary kỳ; rate 0 chủ động; mode timesheet cộng dồn ca trực
 *  - Sales/MKT/Manager: HĐ Paid vs Unpaid/Cancelled; attribution đúng người; rate 0 giữ 0
 *  - Payroll: Pending refresh sau khi HĐ Paid; Paid bất biến; idempotent chạy 2 lần
 *  - Dashboard/KPI/Payroll: cùng số cho cùng input
 *  - Export: numeric cell + numFmt + tổng SUM; CSV raw number
 *  - Import: header lệch cột/STT/dòng 3; thiếu cột phone báo lỗi
 *  - Macros: validate tổng 100
 */
const mongoose = require('mongoose');
const { connectTestDb } = require('../helpers/testDb');
jest.setTimeout(90000);

const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const Contract = require('../../src/modules/contracts/models/contractModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');
const Timesheet = require('../../src/modules/pt/models/timesheetModel.js');
const Payroll = require('../../src/modules/finance/models/payrollModel.js');
const SystemSettings = require('../../src/modules/platform/models/systemSettingsModel.js');
const payrollService = require('../../src/modules/finance/services/payrollService');
const kpiService = require('../../src/modules/platform/services/kpiService');
const { detectHeader } = require('../../src/utils/importNormalize');
const { validateMacros, normalizeMacros } = require('../../src/utils/macroValidate');
const { generateContractCode, initialsOf } = require('../../src/utils/contractCode');

const M = 'I158';
const now = new Date();
const Y = now.getFullYear(), Mo = now.getMonth(); // 0-based
const startOfMonth = new Date(Y, Mo, 1);
const endOfMonth = new Date(Y, Mo + 1, 0, 23, 59, 59, 999);
const mid = new Date(Y, Mo, 10, 10, 0, 0);

let branch, pt, sale, mkt, mgr, client, settingsBackup;
const mkUser = (name, role, extra = {}) => User.create({
    name, email: `${name.toLowerCase()}.${M}@test.local`, password: 'x12345678',
    role, status: 'Active', branch: branch._id, baseSalary: 5000000, ...extra
});
const mkContract = (o) => Contract.create({
    client: client._id, branch: branch._id, servicePackage: new mongoose.Types.ObjectId(),
    packageSnapshot: { name: 'PT100', type: 'PT', duration: 365, price: 50000000, sessions: 100 },
    basePrice: 50000000, totalAmount: 55000000, netAmount: 50000000, totalSessions: 100,
    paidAmount: 55000000, paymentStatus: 'Paid', contractStatus: 'Active',
    startDate: startOfMonth, endDate: endOfMonth, paymentDeadline: endOfMonth,
    ...o
});

beforeAll(async () => {
    await connectTestDb();
    branch = await Branch.create({ name: `${M} Branch`, address: '1 Test', phone: '0900000158' });
    // rate: pt 10%, sale 5%, mkt 4%, mgr 0% (chủ động 0 → phải giữ 0, không fallback 5)
    pt = await mkUser(`${M}pt`, 'PT', { ptCommissionRate: 10, salesCommissionRate: 5 });
    sale = await mkUser(`${M}sale`, 'Sales', { salesCommissionRate: 5 });
    mkt = await mkUser(`${M}mkt`, 'Marketing', { salesCommissionRate: 4 });
    mgr = await mkUser(`${M}mgr`, 'Manager', { salesCommissionRate: 0 });
    client = await mkUser(`${M}client`, 'Client');
    settingsBackup = await SystemSettings.findOne({ key: 'global' }).lean();
    await SystemSettings.updateOne({ key: 'global' }, { $set: { ptPayrollMode: 'contract', timesheetRatePerShift: 100000, defaultPtCommissionRate: 5 } }, { upsert: true });
});

afterAll(async () => {
    try {
        const extra = await User.find({ name: new RegExp(`^${M}`) }).select('_id').lean();
        const ids = extra.map(u => u._id);
        const cs = await Contract.find({ contractCode: new RegExp(`^${M}`) }).select('_id').lean();
        const cids = cs.map(c => c._id);
        await WorkoutSession.deleteMany({ contract: { $in: cids } });
        await Timesheet.deleteMany({ staff: { $in: ids } });
        await Payroll.deleteMany({ staff: { $in: ids } });
        await Contract.deleteMany({ _id: { $in: cids } });
        await User.deleteMany({ name: new RegExp(`^${M}`) });
        await Branch.deleteMany({ name: `${M} Branch` });
        if (settingsBackup) {
            await SystemSettings.updateOne({ key: 'global' }, { $set: {
                ptPayrollMode: settingsBackup.ptPayrollMode || 'contract',
                timesheetRatePerShift: settingsBackup.timesheetRatePerShift ?? 120000,
                defaultPtCommissionRate: settingsBackup.defaultPtCommissionRate ?? 5
            } });
        }
    } finally { await mongoose.connection.close(); }
});

describe('ISSUE 8/2 — HH dạy PT theo buổi', () => {
    let c;
    beforeAll(async () => {
        c = await mkContract({ contractCode: `${M}-PT-1`, sales: mgr._id, pt: pt._id }); // sales=mgr(rate 0) để không lẫn số của sale
        const s = (status, when) => WorkoutSession.create({ client: client._id, pt: pt._id, contract: c._id, branch: branch._id, scheduledTime: when, status });
        await s('Completed', mid);
        await s('Confirmed', new Date(Y, Mo, 12, 9));
        await s('Scheduled', new Date(Y, Mo, 20, 9));      // KHÔNG tính
        await s('Cancelled', new Date(Y, Mo, 21, 9));      // KHÔNG tính
        await s('Completed', new Date(Y, Mo + 1, 1, 0, 0, 1)); // ngoài kỳ (đầu tháng sau) — KHÔNG tính
        await s('Completed', new Date(Y, Mo, 1, 0, 0, 1));     // đầu kỳ 00:00:01 — TÍNH
    });
    test('50tr/100 buổi × 10% = 50.000/buổi; 3 buổi đủ điều kiện = 150.000; taughtCount = 3', async () => {
        const r = await payrollService.calculateStaffCommission(pt, startOfMonth, endOfMonth);
        expect(r.teaching.taughtSessionCount).toBe(3);
        expect(r.teachingCommission).toBe(150000);
        expect(r.teaching.ptRate).toBe(10);
        // HĐ này sales = mgr, không phải pt → PT không có HH sale
        expect(r.salesCommission).toBe(0);
        expect(r.totalCommission).toBe(150000);
    });
    test('mode TIMESHEET: HH dạy GIỮ NGUYÊN + cộng thêm thù lao ca trực (không thay thế)', async () => {
        await SystemSettings.updateOne({ key: 'global' }, { $set: { ptPayrollMode: 'timesheet' } });
        await Timesheet.create({ staff: pt._id, branch: branch._id, checkIn: new Date(Y, Mo, 5, 8), checkOut: new Date(Y, Mo, 5, 12), status: 'Approved' });
        await Timesheet.create({ staff: pt._id, branch: branch._id, checkIn: new Date(Y, Mo, 6, 8), checkOut: new Date(Y, Mo, 6, 12), status: 'Approved' });
        await Timesheet.create({ staff: pt._id, branch: branch._id, checkIn: new Date(Y, Mo, 7, 8), checkOut: null, status: 'Approved' }); // thiếu checkOut → không tính
        await Timesheet.create({ staff: pt._id, branch: branch._id, checkIn: new Date(Y, Mo, 8, 8), checkOut: new Date(Y, Mo, 8, 12), status: 'Pending_Approval' }); // chưa duyệt
        const r = await payrollService.calculateStaffCommission(pt, startOfMonth, endOfMonth);
        expect(r.teachingCommission).toBe(150000);        // vẫn còn — trước đây bị về 0
        expect(r.teaching.approvedShiftCount).toBe(2);
        expect(r.timesheetCommission).toBe(200000);       // 2 ca × 100.000
        expect(r.totalCommission).toBe(350000);
        await SystemSettings.updateOne({ key: 'global' }, { $set: { ptPayrollMode: 'contract' } });
    });
    test('rate 0 chủ động → HH dạy 0 (không fallback); rate null → fallback Settings.defaultPtCommissionRate=5', async () => {
        await User.updateOne({ _id: pt._id }, { $set: { ptCommissionRate: 0 } });
        let r = await payrollService.calculateStaffCommission(await User.findById(pt._id).lean(), startOfMonth, endOfMonth);
        expect(r.teachingCommission).toBe(0);
        expect(r.teaching.ptRate).toBe(0);
        await User.updateOne({ _id: pt._id }, { $unset: { ptCommissionRate: '' } });
        r = await payrollService.calculateStaffCommission(await User.findById(pt._id).lean(), startOfMonth, endOfMonth);
        expect(r.teaching.ptRate).toBe(5);
        expect(r.teachingCommission).toBe(75000); // 3 × 25.000
        await User.updateOne({ _id: pt._id }, { $set: { ptCommissionRate: 10 } });
    });
});

describe('ISSUE 4/6/7/9 — HH sale các role, attribution, Paid-only', () => {
    beforeAll(async () => {
        await mkContract({ contractCode: `${M}-S-1`, sales: sale._id, pt: pt._id });                          // sale: 50tr Paid
        await mkContract({ contractCode: `${M}-S-2`, sales: sale._id, pt: pt._id, paymentStatus: 'Unpaid', paidAmount: 0 }); // không tính
        await mkContract({ contractCode: `${M}-S-3`, sales: sale._id, pt: pt._id, contractStatus: 'Cancelled' });          // không tính
        await mkContract({ contractCode: `${M}-M-1`, sales: mkt._id, pt: pt._id });                            // mkt: 50tr Paid
        await mkContract({ contractCode: `${M}-G-1`, sales: mgr._id, pt: pt._id });                            // mgr rate 0
    });
    test('Sales: 1 HĐ Paid 50tr × 5% = 2.500.000; Unpaid/Cancelled không tính', async () => {
        const r = await payrollService.calculateStaffCommission(sale, startOfMonth, endOfMonth);
        expect(r.sales.eligibleContractCount).toBe(1);
        expect(r.salesCommission).toBe(2500000);
        expect(r.teachingCommission).toBe(0);
    });
    test('Marketing: 50tr × 4% = 2.000.000 (attribution đúng người, không lẫn HĐ của Sales)', async () => {
        const r = await payrollService.calculateStaffCommission(mkt, startOfMonth, endOfMonth);
        expect(r.sales.eligibleContractCount).toBe(1);
        expect(r.salesCommission).toBe(2000000);
    });
    test('Manager rate 0 chủ động → 0 (KHÔNG fallback 5%)', async () => {
        const r = await payrollService.calculateStaffCommission(mgr, startOfMonth, endOfMonth);
        expect(r.sales.eligibleContractCount).toBe(2);
        expect(r.sales.rate).toBe(0);
        expect(r.salesCommission).toBe(0);
    });
    test('KPI (getPersonalSalesCommission) trả CÙNG số với engine', async () => {
        const k = await kpiService.getEmployeeKPI(await User.findById(sale._id), Mo + 1, Y);
        expect(k.personalCommission).toBe(2500000);
        expect(k.personalContractCount).toBe(1);
    });
});

describe('ISSUE 4 — Payroll Pending refresh, Paid bất biến, idempotent', () => {
    let staff2;
    beforeAll(async () => { staff2 = await mkUser(`${M}sale2`, 'Sales', { salesCommissionRate: 5 }); });
    test('tạo Pending khi chưa có HĐ → sale 0; HĐ Paid sau đó → gọi lại refresh thành 2.500.000/2 mỗi kỳ; chạy lần 3 không đổi', async () => {
        const month = Mo + 1, year = Y;
        let calc = await payrollService.calculateStaffCommission(staff2, startOfMonth, endOfMonth);
        let recs = await payrollService.generateBiMonthlyPayroll(staff2, calc.totalCommission, month, year, { teaching: 0, timesheet: 0, sales: calc.salesCommission });
        expect(recs).toHaveLength(2);
        expect(recs[0].salesCommission).toBe(0);
        // HĐ Paid xuất hiện SAU khi tạo payroll (đúng kịch bản mkt148 trên prod)
        await mkContract({ contractCode: `${M}-S2-1`, sales: staff2._id, pt: pt._id });
        calc = await payrollService.calculateStaffCommission(staff2, startOfMonth, endOfMonth);
        expect(calc.salesCommission).toBe(2500000);
        recs = await payrollService.generateBiMonthlyPayroll(staff2, calc.totalCommission, month, year, { teaching: 0, timesheet: 0, sales: calc.salesCommission });
        expect(recs[0].salesCommission).toBe(1250000);
        expect(recs[1].salesCommission).toBe(1250000);
        expect(recs[0].commission).toBe(1250000);
        expect(recs[0].totalSalary).toBe(2500000 + 1250000);
        expect(recs[0].commissionCalculatedAt).toBeTruthy();
        // idempotent: chạy lại y hệt → không đổi, không tạo thêm
        const again = await payrollService.generateBiMonthlyPayroll(staff2, calc.totalCommission, month, year, { teaching: 0, timesheet: 0, sales: calc.salesCommission });
        expect(again[0].salesCommission).toBe(1250000);
        expect(await Payroll.countDocuments({ staff: staff2._id, month, year })).toBe(2);
    });
    test('record Paid KHÔNG bị refresh', async () => {
        const month = Mo + 1, year = Y;
        await Payroll.updateOne({ staff: staff2._id, month, year, period: 1 }, { $set: { status: 'Paid' } });
        await mkContract({ contractCode: `${M}-S2-2`, sales: staff2._id, pt: pt._id }); // thêm 50tr nữa
        const calc = await payrollService.calculateStaffCommission(staff2, startOfMonth, endOfMonth);
        expect(calc.salesCommission).toBe(5000000);
        const recs = await payrollService.generateBiMonthlyPayroll(staff2, calc.totalCommission, month, year, { teaching: 0, timesheet: 0, sales: calc.salesCommission });
        const p1 = recs.find(r => r.period === 1), p2 = recs.find(r => r.period === 2);
        expect(p1.salesCommission).toBe(1250000);  // Paid → giữ nguyên
        expect(p2.salesCommission).toBe(2500000);  // Pending → refresh
    });
});

describe('QA1 — boundary/quyền/export field', () => {
    test('boundary: buổi Completed lúc 23:59:59.500 ngày cuối tháng vẫn được tính (kỳ [start, 23:59:59.999])', async () => {
        const c = await Contract.findOne({ contractCode: `${M}-PT-1` });
        await WorkoutSession.create({ client: client._id, pt: pt._id, contract: c._id, branch: branch._id,
            scheduledTime: new Date(Y, Mo + 1, 0, 23, 59, 59, 500), status: 'Completed' });
        const payrollController = require('../../src/modules/finance/controllers/payrollController');
        const req = { query: { month: String(Mo + 1), year: String(Y), role: 'PT' }, session: { user: { role: 'Admin' } } };
        const { rows } = await payrollController._buildPayrollExportRows(req);
        const r = rows.find(x => x.name === `${M}pt`);
        expect(r.taughtCount).toBe(4); // 3 cũ + 1 sát biên = 4 buổi/tháng (count tháng, không chia đôi)
    });
    test('Manager KHÔNG có branch → export rỗng (fail-closed), Manager có branch → chỉ thấy branch mình', async () => {
        const payrollController = require('../../src/modules/finance/controllers/payrollController');
        const noBranch = { query: { month: String(Mo + 1), year: String(Y) }, session: { user: { role: 'Manager', branch: null } } };
        const r1 = await payrollController._buildPayrollExportRows(noBranch);
        expect(r1.rows.filter(x => x.name.startsWith(M)).length).toBe(0);
        const withBranch = { query: { month: String(Mo + 1), year: String(Y) }, session: { user: { role: 'Manager', branch: branch._id } } };
        const r2 = await payrollController._buildPayrollExportRows(withBranch);
        expect(r2.rows.filter(x => x.name.startsWith(M)).length).toBeGreaterThan(0);
        expect(r2.rows.every(x => x.branch === `${M} Branch` || !x.name.startsWith(M))).toBe(true);
    });
    test('export "Ngày trả" đọc paymentDate của record Paid', async () => {
        const staffX = await mkUser(`${M}paid`, 'Sales', { salesCommissionRate: 5 });
        const paidAt = new Date(Y, Mo, 20, 9, 0, 0);
        await Payroll.create({ staff: staffX._id, month: Mo + 1, year: Y, period: 1, baseSalary: 2500000, commission: 0,
            teachingCommission: 0, timesheetCommission: 0, salesCommission: 0, deductions: 0, totalSalary: 2500000,
            status: 'Paid', paymentDate: paidAt, suggestedPayDate: new Date(Y, Mo + 1, 5) });
        const payrollController = require('../../src/modules/finance/controllers/payrollController');
        const req = { query: { month: String(Mo + 1), year: String(Y), role: 'Sales' }, session: { user: { role: 'Admin' } } };
        const { rows } = await payrollController._buildPayrollExportRows(req);
        const r = rows.find(x => x.name === `${M}paid` && x.period === 'Kỳ 1');
        expect(r.status).toBe('Đã thanh toán');
        expect(r.paidAt && r.paidAt.getTime()).toBe(paidAt.getTime());
    });
});

describe('ISSUE 5 — export payroll XLSX/CSV', () => {
    test('XLSX: cell tiền là NUMBER, numFmt #,##0, đủ cột HH dạy/ca trực/sale, dòng TỔNG có formula', async () => {
        const payrollController = require('../../src/modules/finance/controllers/payrollController');
        const req = { query: { month: String(Mo + 1), year: String(Y), role: 'Sales' }, session: { user: { role: 'Admin' } } };
        const { rows } = await payrollController._buildPayrollExportRows(req);
        const mine = rows.filter(r => r.name.startsWith(M));
        expect(mine.length).toBeGreaterThanOrEqual(2);
        const r = mine.find(x => x.name === `${M}sale`);
        expect(typeof r.salesCommission).toBe('number');
        expect(r.salesCommission).toBe(1250000);
        expect(typeof r.baseSalary).toBe('number');
        expect(r).toHaveProperty('teachingCommission');
        expect(r).toHaveProperty('timesheetCommission');
        // render xlsx vào buffer
        const ExcelJS = require('exceljs');
        const res = { headers: {}, chunks: [], setHeader(k, v) { this.headers[k] = v; }, write(c) { this.chunks.push(Buffer.from(c)); }, end() {} };
        await payrollController.exportPayrollXLSX(req, res, (e) => { throw e; });
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(Buffer.concat(res.chunks));
        const ws = wb.worksheets[0];
        const hdr = ws.getRow(1).values.slice(1);
        expect(hdr).toEqual(expect.arrayContaining(['Hoa hồng dạy', 'Thù lao ca trực', 'Hoa hồng sale', 'Thực nhận']));
        const colIdx = hdr.indexOf('Hoa hồng sale') + 1;
        expect(ws.getColumn(colIdx).numFmt).toBe('#,##0');
        let sawNumber = false, sawFormula = false;
        ws.eachRow((row, n) => {
            if (n === 1) return;
            const v = row.getCell(colIdx).value;
            if (typeof v === 'number') sawNumber = true;
            if (v && typeof v === 'object' && v.formula) sawFormula = true;
        });
        expect(sawNumber).toBe(true);
        expect(sawFormula).toBe(true);
    });
});

describe('ISSUE 3 — import header detect', () => {
    const fakeWs = (rows) => ({
        rowCount: rows.length, columnCount: Math.max(...rows.map(r => r.length)),
        getRow: (i) => ({ cellCount: (rows[i - 1] || []).length, getCell: (c) => ({ value: (rows[i - 1] || [])[c - 1] }) })
    });
    test('layout chuẩn', () => {
        const h = detectHeader(fakeWs([['Họ tên', 'Số điện thoại', 'Email'], ['A', '0912345678', '']]));
        expect(h.headerRow).toBe(1); expect(h.map.name).toBe(1); expect(h.map.phone).toBe(2); expect(h.missing).toEqual([]);
    });
    test('có STT đầu + đổi thứ tự + header ở dòng 3 + alias "SĐT"', () => {
        const h = detectHeader(fakeWs([['DANH SÁCH KH'], [''], ['STT', 'Email', 'SĐT', 'Tên khách hàng', 'CMND'], ['1', 'a@b.c', 912345678, 'Nguyễn A', '079212345678']]));
        expect(h.headerRow).toBe(3); expect(h.map.phone).toBe(3); expect(h.map.name).toBe(4); expect(h.map.cccd).toBe(5); expect(h.missing).toEqual([]);
    });
    test('thiếu cột phone → missing báo rõ, không đọc bừa theo vị trí', () => {
        const h = detectHeader(fakeWs([['Họ tên', 'Email', 'Địa chỉ'], ['A', 'x@y.z', 'HN']]));
        expect(h.missing).toEqual(['phone']);
    });
});

describe('ISSUE 1 — macros %', () => {
    test('30/35/25/10 hợp lệ; 30/35/25/5 bị chặn; giá trị >100 bị chặn', () => {
        expect(validateMacros(normalizeMacros({ protein: 30, carbs: 35, fat: 25, fiber: 10 }))).toBeNull();
        expect(validateMacros({ protein: 30, carbs: 35, fat: 25, fiber: 5 })).toMatch(/100%/);
        expect(validateMacros({ protein: 130, carbs: 0, fat: 0, fiber: 0 })).toMatch(/0 đến 100/);
    });
});

describe('ISSUE 0 — mã HĐ (QA2: tạo đồng thời)', () => {
    test('8 request tạo HĐ đồng thời cùng KH → 8 mã KHÁC NHAU, không request nào fail vì trùng', async () => {
        const contractService = require('../../src/modules/contracts/services/contractService');
        const mk = () => contractService.createContract({
            clientId: client._id, branchId: branch._id, salesId: sale._id, ptId: pt._id,
            customPackage: { name: `${M} concurrent`, type: 'Gym', duration: 1, durationMonths: 1, price: 1000000, sessions: 10 },
            startDate: startOfMonth
        });
        const results = await Promise.allSettled(Array.from({ length: 8 }, mk));
        const ok = results.filter(r => r.status === 'fulfilled');
        const failReasons = results.filter(r => r.status === 'rejected').map(r => r.reason && r.reason.message);
        expect(failReasons).toEqual([]);
        const codes = ok.map(r => r.value.contractCode);
        expect(new Set(codes).size).toBe(8);
        // dọn: mark để afterAll xoá (contractCode không bắt đầu bằng I158 → xoá theo packageSnapshot.name)
        await Contract.deleteMany({ 'packageSnapshot.name': `${M} concurrent` });
    });

    test('viết tắt bỏ dấu, tối đa 4; trùng → -2; tiếng Việt Đ/Ă xử lý đúng', async () => {
        expect(initialsOf('Nguyễn Văn An')).toBe('NVA');
        expect(initialsOf('Đặng Thị Ăn Ý')).toBe('DTAY');
        expect(initialsOf('Trần Thị Bích Ngọc Hạnh')).toBe('TTBN');
        expect(initialsOf('')).toBe('KH');
        const seen = new Set();
        const exists = async (c) => seen.has(c);
        const d = new Date(2026, 6, 12);
        const c1 = await generateContractCode('Nguyễn Văn An', exists, d); seen.add(c1);
        const c2 = await generateContractCode('Ngô Vũ Anh', exists, d);   seen.add(c2);
        expect(c1).toBe('12.07.2026/NVA');
        expect(c2).toBe('12.07.2026/NVA-2');
    });
});
