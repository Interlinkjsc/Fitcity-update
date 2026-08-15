/**
 * Rp 15/8 (158.xlsx v2) — IMPORT/EXPORT KHÁCH HÀNG: contract chung + ROUND-TRIP + ma trận branch/file/security.
 * Acceptance bắt buộc: file "Xuất Excel" → thêm 1 dòng KH mới → import → dòng mới tạo đúng branch,
 * dòng cũ báo TRÙNG (không MISSING_BRANCH sai), không tạo trùng KH cũ.
 * Không dropDatabase (DB test dùng chung) — dọn theo marker RT.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const { connectTestDb } = require('../helpers/testDb');
jest.setTimeout(90000);

const User = require('../../src/modules/users/models/userModel.js');
const Branch = require('../../src/modules/crm/models/branchModel.js');
const ctrl = require('../../src/modules/clients/controllers/clientManagementController');
const schema = require('../../src/modules/clients/clientImportSchema');
const { resolveBranch, loadBranchCache } = require('../../src/modules/clients/resolveBranch');
const { detectHeader, HEADER_ALIASES } = require('../../src/utils/importNormalize');
const { hash } = require('../../src/utils/encryption');
const Reservation = require('../../src/modules/clients/models/clientImportReservationModel');

const M = 'RTIMP';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtimp-'));
let brA, brB, brClosed, admin, manager;

const mkClient = (o) => User.create({ role: 'Client', status: 'Active', password: 'x12345678', ...o });
const writeXlsx = async (headers, rows, file, opts = {}) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(opts.sheet || 'Data');
    if (opts.preRows) opts.preRows.forEach(r => ws.addRow(r));
    ws.addRow(headers);
    rows.forEach(r => ws.addRow(r));
    const p = path.join(TMP, file);
    await wb.xlsx.writeFile(p);
    return p;
};
const writeCsv = (content, file, bom = false) => {
    const p = path.join(TMP, file);
    fs.writeFileSync(p, (bom ? '﻿' : '') + content, 'utf8');
    return p;
};
// Chạy exportClients thật, thu buffer, mở lại bằng ExcelJS
const exportViaController = async (sessionUser) => {
    const chunks = [];
    const res = { setHeader() {}, write(c) { chunks.push(Buffer.from(c)); }, end() {} };
    await ctrl.exportClients({ session: { user: sessionUser } }, res, (e) => { throw e; });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.concat(chunks));
    return wb;
};
const templateViaController = async () => {
    const chunks = [];
    const res = { setHeader() {}, write(c) { chunks.push(Buffer.from(c)); }, end() {} };
    await ctrl.downloadImportTemplate({}, res, (e) => { throw e; });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.concat(chunks));
    return wb;
};
const importFile = (p, user) => ctrl._importClientsFromFile(p, path.basename(p), user);

beforeAll(async () => {
    await connectTestDb();
    // dọn dữ liệu sót từ run trước (marker ở bất kỳ vị trí nào trong tên/email)
    await User.deleteMany({ $or: [{ name: new RegExp(M) }, { email: /rtimp/i }] });
    await Branch.deleteMany({ name: new RegExp(M) });
    await Reservation.deleteMany({ phoneHash: { $in: ['0912000001','0912000002','0913000001','0916000001','0916000002','0917000002','0919000001','0919000002','0919000003','0921000001','0921000009','0922000001','0923000001'].map(hash) } });
    brA = await Branch.create({ name: `${M} Chi Nhánh Hoàn Kiếm`, address: 'a', phone: '0900000101', status: 'Open' });
    brB = await Branch.create({ name: `${M} Chi Nhánh Đà Nẵng`, address: 'b', phone: '0900000102', status: 'Open' });
    brClosed = await Branch.create({ name: `${M} Chi Nhánh Đã Đóng`, address: 'c', phone: '0900000103', status: 'Closed' });
    admin = { id: 'admin', role: 'Admin' };                       // KHÔNG có branch (như prod)
    manager = { id: 'mgr', role: 'Manager', branch: brA._id };
});

afterAll(async () => {
    try {
        await User.deleteMany({ $or: [{ name: new RegExp(M) }, { email: /rtimp/i }] });
        await Branch.deleteMany({ name: new RegExp(M) });
        await Reservation.deleteMany({ phoneHash: { $in: ['0912000001','0912000002','0913000001','0916000001','0916000002','0917000002','0919000001','0919000002','0919000003','0921000001','0921000009','0922000001','0923000001'].map(hash) } });
        fs.rmSync(TMP, { recursive: true, force: true });
    } finally { await mongoose.connection.close(); }
});

describe('A. Contract/schema', () => {
    test('export header == template header (importable) == alias chuẩn; đổi schema → test fail', async () => {
        const exp = schema.getExportColumns().map(f => f.header);
        const tpl = schema.getTemplateColumns().map(f => f.header);
        expect(exp).toEqual(['Họ tên', 'Số điện thoại', 'Email', 'Số CCCD', 'Giới tính', 'Ngày sinh', 'Địa chỉ', 'Chi nhánh', 'Trạng thái']);
        expect(tpl).toEqual(['Họ tên', 'Số điện thoại', 'Email', 'Số CCCD', 'Giới tính', 'Ngày sinh', 'Địa chỉ', 'Chi nhánh']);
        expect(schema.getImportRequiredKeys()).toEqual(['name', 'phone', 'branch']);
        // alias trong importNormalize (fallback) không được lệch schema
        const a = schema.getHeaderAliases();
        for (const k of Object.keys(HEADER_ALIASES)) expect(a[k]).toEqual(expect.arrayContaining(HEADER_ALIASES[k]));
        // file thật sinh từ controller khớp header schema
        const wbT = await templateViaController();
        expect(wbT.getWorksheet('Danh sách KH').getRow(1).values.slice(1)).toEqual(tpl);
        expect(wbT.getWorksheet('Hướng dẫn')).toBeTruthy();
        // SĐT/CCCD/DOB text format
        const wsT = wbT.getWorksheet('Danh sách KH');
        expect(wsT.getColumn(2).numFmt).toBe('@');
        expect(wsT.getColumn(4).numFmt).toBe('@');
    });
    test('importer nhận cả file template lẫn file export (detectHeader không thiếu cột)', async () => {
        const wbT = await templateViaController();
        const h1 = detectHeader(wbT.getWorksheet('Danh sách KH'), schema.getImportRequiredKeys(), { aliases: schema.getHeaderAliases() });
        expect(h1.missing).toEqual([]);
        await mkClient({ name: `${M} Seed Export`, email: `seed.rtimp@test.local`, phone: '0911000001', branch: brA._id, gender: 'Nam', dob: new Date(1990, 7, 15) });
        const wbE = await exportViaController(admin);
        const h2 = detectHeader(wbE.worksheets[0], schema.getImportRequiredKeys(), { aliases: schema.getHeaderAliases() });
        expect(h2.missing).toEqual([]);
        expect(h2.map.status).toBeDefined(); // cột Trạng thái nhận diện được nhưng importer bỏ qua
    });
});

describe('B. ROUND-TRIP (acceptance bắt buộc): export → thêm dòng mới → import', () => {
    test('dòng mới tạo đúng branch; dòng cũ báo TRÙNG; không MISSING_BRANCH; không tạo trùng KH cũ', async () => {
        await mkClient({ name: `${M} Cũ Một`, email: `cu1.rtimp@test.local`, phone: '0912000001', branch: brA._id, gender: 'Nữ', dob: new Date(1985, 0, 31) });
        await mkClient({ name: `${M} Cũ Hai`, email: `cu2.rtimp@test.local`, phone: '0912000002', branch: brB._id, gender: 'Nam' });
        const before = await User.countDocuments({ role: 'Client', name: new RegExp(`^${M}`) });

        // 1) export thật bằng controller (Admin không có branch)
        const wb = await exportViaController(admin);
        const ws = wb.worksheets[0];
        const hdr = ws.getRow(1).values.slice(1);
        expect(hdr).toEqual(schema.getExportColumns().map(f => f.header));
        // KH cũ phải có tên chi nhánh trong file (round-trip resolve được)
        let rowCu1;
        ws.eachRow((r, n) => { if (n > 1 && String(r.getCell(1).value).includes('Cũ Một')) rowCu1 = r; });
        expect(rowCu1.getCell(8).value).toBe(brA.name);
        expect(rowCu1.getCell(2).value).toBe('0912000001');
        expect(rowCu1.getCell(6).value).toBe('31/01/1985'); // dd/MM/yyyy ổn định, không đảo mm/dd

        // 2) thêm 1 dòng KH MỚI hợp lệ vào chính file đó (khách hay gõ tên chi nhánh khác hoa/thường + thừa khoảng trắng)
        ws.addRow([`${M} Mới Thêm`, '0913000001', '', '079212345678', 'nữ', '02/03/1992', '5 Lý Thường Kiệt', `  ${brB.name.toLowerCase()}  `, '']);
        const p = path.join(TMP, 'export_plus_new.xlsx');
        await wb.xlsx.writeFile(p);

        // 3) import lại
        const r = await importFile(p, admin);
        expect(r.created).toBe(1);
        expect(r.level).toBe('success_msg');
        expect(r.message).toMatch(/MỘT PHẦN/);
        // dòng cũ (có branch hợp lệ): báo TRÙNG (SĐT hoặc email), KHÔNG phải thiếu chi nhánh
        // → đối chiếu theo số dòng của chính các KH seed (DB test dùng chung có thể chứa KH khác)
        const rowIdxByName = {};
        ws.eachRow((rr, n) => { if (n > 1) rowIdxByName[String(rr.getCell(1).value)] = n; });
        for (const nm of [`${M} Cũ Một`, `${M} Cũ Hai`, `${M} Seed Export`]) {
            const reason = r.skipReasons.find(x => x.startsWith(`Dòng ${rowIdxByName[nm]}:`));
            expect(reason).toMatch(/trùng SĐT|trùng email/);
            expect(reason).not.toMatch(/Vui lòng chọn chi nhánh|ô Chi nhánh trống|không tìm thấy chi nhánh/);
        }
        // tuyệt đối không còn thông báo chung chung sai nguyên nhân của bản cũ
        expect(r.skipReasons.join(' | ')).not.toMatch(/Vui lòng chọn chi nhánh cho khách hàng/);
        // dòng mới đúng branch B, gender chuẩn hoá, dob đúng, status Active, không import Trạng thái
        const created = await User.findOne({ name: `${M} Mới Thêm` }).lean();
        expect(String(created.branch)).toBe(String(brB._id));
        expect(created.gender).toBe('Nữ');
        expect(created.status).toBe('Active');
        expect(new Date(created.dob).getDate()).toBe(2);
        expect(new Date(created.dob).getMonth()).toBe(2);
        // 4) không tạo trùng KH cũ
        const after = await User.countDocuments({ role: 'Client', name: new RegExp(`^${M}`) });
        expect(after).toBe(before + 1);
        // 5) upload lại NGUYÊN file lần nữa → 0 tạo mới, tất cả báo trùng
        const r2 = await importFile(p, admin);
        expect(r2.created).toBe(0);
        expect(r2.level).toBe('error_msg');
        expect(r2.message).toMatch(/THẤT BẠI/);
        // mọi dòng có branch hợp lệ đều báo trùng; dòng KH cũ không branch (nếu có trong DB test) báo "ô Chi nhánh trống" — đúng nguyên nhân
        expect(r2.skipReasons.every(s => /trùng SĐT|trùng email|ô Chi nhánh trống/.test(s))).toBe(true);
        expect(await User.countDocuments({ role: 'Client', name: new RegExp(`^${M}`) })).toBe(before + 1);
    });
});

describe('C. Branch matrix (resolveBranch)', () => {
    let cache;
    beforeAll(async () => { cache = await loadBranchCache(); });
    test('exact / khác hoa thường / thừa khoảng trắng / NFD / không dấu (1 match) → đúng branch A', () => {
        for (const n of [brA.name, brA.name.toUpperCase(), `  ${brA.name}   `, brA.name.replace('Chi Nhánh', 'Chi  Nhánh'), brA.name.normalize('NFD'), `${M} chi nhanh hoan kiem`]) {
            const r = resolveBranch(n, admin, cache);
            expect(r.error).toBeUndefined();
            expect(String(r.branchId)).toBe(String(brA._id));
        }
    });
    test('không tồn tại → BRANCH_NOT_FOUND kèm tên; trống → BRANCH_MISSING (Admin không được gán ngầm)', () => {
        const r1 = resolveBranch('Chi nhánh Sao Hoả', admin, cache);
        expect(r1.error).toBe('BRANCH_NOT_FOUND'); expect(r1.message).toContain('Sao Hoả');
        const r2 = resolveBranch('', admin, cache);
        expect(r2.error).toBe('BRANCH_MISSING');
    });
    test('đã đóng → BRANCH_CLOSED', () => {
        expect(resolveBranch(brClosed.name, admin, cache).error).toBe('BRANCH_CLOSED');
    });
    test('không dấu khớp NHIỀU branch → BRANCH_AMBIGUOUS (không tự chọn)', async () => {
        const x1 = await Branch.create({ name: `${M} Cơ Sở Tân Bình`, address: 'x', phone: '0900000104' });
        const x2 = await Branch.create({ name: `${M} Cơ Sở Tấn Bính`, address: 'y', phone: '0900000105' });
        const c2 = await loadBranchCache();
        const r = resolveBranch(`${M} co so tan binh`, admin, c2);
        expect(r.error).toBe('BRANCH_AMBIGUOUS');
        // nhưng ghi ĐÚNG dấu thì resolve chính xác
        expect(String(resolveBranch(x1.name, admin, c2).branchId)).toBe(String(x1._id));
        await Branch.deleteMany({ _id: { $in: [x1._id, x2._id] } });
    });
    test('Manager: trống → branch của mình; đúng branch → OK; branch khác → FORBIDDEN; Manager không branch → FORBIDDEN', () => {
        expect(String(resolveBranch('', manager, cache).branchId)).toBe(String(brA._id));
        expect(String(resolveBranch(brA.name, manager, cache).branchId)).toBe(String(brA._id));
        expect(resolveBranch(brB.name, manager, cache).error).toBe('BRANCH_FORBIDDEN');
        expect(resolveBranch(brA.name, { role: 'Manager', branch: null }, cache).error).toBe('BRANCH_FORBIDDEN');
        expect(resolveBranch('', { role: 'Manager', branch: null }, cache).error).toBe('BRANCH_FORBIDDEN');
    });
    test('Admin có tên branch không tồn tại KHÔNG fallback session branch', () => {
        const adminWithBranch = { role: 'Admin', branch: brA._id };
        expect(resolveBranch('Không Có Thật', adminWithBranch, cache).error).toBe('BRANCH_NOT_FOUND');
    });
    test('import thật: Manager cố import vào branch khác → skip với lý do quyền', async () => {
        const p = await writeXlsx(['Họ tên', 'Số điện thoại', 'Chi nhánh'], [[`${M} MgrX`, '0914000001', brB.name]], 'mgr_other.xlsx');
        const r = await importFile(p, manager);
        expect(r.created).toBe(0);
        expect(r.skipReasons[0]).toMatch(/không có quyền import vào chi nhánh/);
    });
    test('KH cũ không có branch → export ô trống → import báo "ô Chi nhánh trống" (không phải MISSING_BRANCH chung chung)', async () => {
        await mkClient({ name: `${M} Không Branch`, email: `nb.rtimp@test.local`, phone: '0915000001' });
        const wb = await exportViaController(admin);
        const ws = wb.worksheets[0];
        // giữ lại chỉ dòng "Không Branch" nhưng đổi SĐT để không đụng dup
        const p = await writeXlsx(schema.getExportColumns().map(f => f.header), [[`${M} Không Branch 2`, '0915000002', '', '', '', '', '', '', 'Active']], 'nobranch.xlsx');
        const r = await importFile(p, admin);
        expect(r.created).toBe(0);
        expect(r.skipReasons[0]).toMatch(/ô Chi nhánh trống/);
        expect(r.skipReasons[0]).not.toMatch(/Vui lòng chọn chi nhánh cho khách hàng/);
        void ws;
    });
});

describe('D. File matrix', () => {
    test('.csv UTF-8 có BOM, phone number mất 0, CCCD 0 đầu, dob dd/mm/yyyy, dòng trống, cột đổi thứ tự, có Trạng thái', async () => {
        const csv = [
            'STT,Chi nhánh,Số điện thoại,Trạng thái,Họ tên,Số CCCD,Ngày sinh',
            `1,${brA.name},916000001,Suspended,${M} CSV Một,79212345678,05/11/1988`,
            '',
            `2,${brA.name},0916000002,Resigned,${M} CSV Hai,,`
        ].join('\n');
        const p = writeCsv(csv, 'kh.csv', true);
        const r = await importFile(p, admin);
        expect(r.created).toBe(2);
        const c1 = await User.findOne({ name: `${M} CSV Một` });
        expect(c1.phone).toBe('0916000001');
        expect(c1.cccdNumber).toBe('079212345678');
        expect(c1.status).toBe('Active');            // Trạng thái từ file bị bỏ qua có chủ đích
        expect(new Date(c1.dob).getMonth()).toBe(10);  // tháng 11, không đảo mm/dd
        expect(String(c1.branch)).toBe(String(brA._id));
    });
    test('header ở dòng 3, dòng ghi chú template không thành KH, dob không tồn tại (31/02) báo lỗi dòng', async () => {
        const p = await writeXlsx(['Họ tên', 'Số điện thoại', 'Chi nhánh', 'Ngày sinh'], [
            [`${M} H3 Một`, '0917000001', brA.name, '31/02/2000'],
            [`${M} H3 Hai`, '0917000002', brA.name, '29/02/2000'],
            ['Ghi chú: xoá dòng này', '', '', '']
        ], 'header3.xlsx', { preRows: [['DANH SÁCH KHÁCH HÀNG'], ['']] });
        const r = await importFile(p, admin);
        expect(r.created).toBe(1);
        expect(r.skipReasons.join(' ')).toMatch(/31\/02\/2000.*không tồn tại/);
        expect(r.skipReasons.join(' ')).not.toMatch(/Ghi chú/);
    });
    test('thiếu cột Chi nhánh (bắt buộc) → báo tên cột, không đọc theo vị trí; 2 cột cùng nghĩa → báo ambiguous', async () => {
        const p1 = await writeXlsx(['Họ tên', 'Số điện thoại'], [[`${M} X`, '0918000001']], 'nobranchcol.xlsx');
        const r1 = await importFile(p1, admin);
        expect(r1.created).toBe(0); expect(r1.message).toMatch(/thiếu cột bắt buộc: Chi nhánh/);
        const p2 = await writeXlsx(['Họ tên', 'SĐT', 'Số điện thoại', 'Chi nhánh'], [[`${M} Y`, '0918000002', '0918000003', brA.name]], 'dupcol.xlsx');
        const r2 = await importFile(p2, admin);
        expect(r2.created).toBe(0); expect(r2.message).toMatch(/nhiều cột cùng ý nghĩa/);
    });
    test('giới tính alias (nam/NỮ/khac) chuẩn hoá; giá trị lạ báo lỗi dòng', async () => {
        const p = await writeXlsx(['Họ tên', 'Số điện thoại', 'Chi nhánh', 'Giới tính'], [
            [`${M} G1`, '0919000001', brA.name, 'nam'],
            [`${M} G2`, '0919000002', brA.name, 'NỮ'],
            [`${M} G3`, '0919000003', brA.name, 'khac'],
            [`${M} G4`, '0919000004', brA.name, 'Alien']
        ], 'gender.xlsx');
        const r = await importFile(p, admin);
        expect(r.created).toBe(3);
        expect(r.skipReasons[0]).toMatch(/giới tính "Alien" không hợp lệ/);
        expect((await User.findOne({ name: `${M} G2` })).gender).toBe('Nữ');
    });
});

describe('E. Security/regression', () => {
    test('formula injection trong export bị vô hiệu (=, +, -, @)', async () => {
        await mkClient({ name: `=HYPERLINK("x")${M} Inj`, email: `inj.rtimp@test.local`, phone: '0920000001', branch: brA._id, address: '+cmd|calc' });
        const wb = await exportViaController(admin);
        let found;
        wb.worksheets[0].eachRow((r, n) => { if (n > 1 && String(r.getCell(1).value).includes('Inj')) found = r; });
        expect(String(found.getCell(1).value).startsWith("'=")).toBe(true);
        expect(String(found.getCell(7).value).startsWith("'+")).toBe(true);
    });
    test('duplicate: SĐT đã tồn tại + email trống → báo trùng SĐT (không tạo bản sao); email đã tồn tại → trùng email', async () => {
        await mkClient({ name: `${M} Dup Src`, email: `dupsrc.rtimp@test.local`, phone: '0921000001', branch: brA._id });
        const p = await writeXlsx(['Họ tên', 'Số điện thoại', 'Email', 'Chi nhánh'], [
            [`${M} Dup Phone`, '0921000001', '', brA.name],
            [`${M} Dup Email`, '0921000009', 'dupsrc.rtimp@test.local', brA.name]
        ], 'dup.xlsx');
        const r = await importFile(p, admin);
        expect(r.created).toBe(0);
        expect(r.skipReasons[0]).toMatch(/trùng SĐT/);
        expect(r.skipReasons[1]).toMatch(/trùng email/);
        // phone được mã hoá trong DB → đếm theo phoneHash
        expect(await User.countDocuments({ phoneHash: hash('0921000001') })).toBe(1);
    });
    test('file tạm bị xoá kể cả khi parse lỗi (importClients controller)', async () => {
        const bad = path.join(TMP, 'broken.xlsx');
        fs.writeFileSync(bad, 'not a zip');
        const flashes = [];
        const req = { importFile: { path: bad, filename: 'broken.xlsx' }, session: { user: admin }, flash: (t, m) => flashes.push({ t, m }) };
        const res = { redirect() {} };
        await ctrl.importClients(req, res, () => {});
        expect(fs.existsSync(bad)).toBe(false);
        expect(flashes[0].t).toBe('error_msg');
        expect(flashes[0].m).not.toMatch(/at .*\.js:\d+/); // không lộ stack trace
    });
    test('QA1 [HIGH]: 2 import ĐỒNG THỜI cùng SĐT mới → chỉ tạo 1 khách (atomic reservation)', async () => {
        const mk = (i) => writeXlsx(['Họ tên', 'Số điện thoại', 'Chi nhánh'], [[`${M} Race ${i}`, '0922000001', brA.name]], `race${i}.xlsx`);
        const [p1, p2] = await Promise.all([mk(1), mk(2)]);
        const [r1, r2] = await Promise.all([importFile(p1, admin), importFile(p2, admin)]);
        expect(r1.created + r2.created).toBe(1);
        const loser = r1.created === 0 ? r1 : r2;
        expect(loser.skipReasons[0]).toMatch(/trùng SĐT/);
        expect(await User.countDocuments({ phoneHash: hash('0922000001') })).toBe(1);
    });
    test('QA1 [LOW]: preamble có 5 ô giống alias trước header thật (dòng 3) → vẫn chọn đúng dòng header có đủ cột bắt buộc', async () => {
        const p = await writeXlsx(['Họ tên', 'Số điện thoại', 'Chi nhánh', 'Email', 'Giới tính'], [[`${M} Pre`, '0923000001', brA.name, '', 'Nam']],
            'preamble.xlsx', { preRows: [['Email', 'Giới tính', 'Địa chỉ', 'Số CCCD', 'Ngày sinh'], ['—']] });
        const r = await importFile(p, admin);
        expect(r.created).toBe(1);
    });
    test('export không phá filter branch của Manager (chỉ thấy KH branch mình)', async () => {
        const wb = await exportViaController(manager);
        const names = [];
        wb.worksheets[0].eachRow((r, n) => { if (n > 1) names.push(String(r.getCell(8).value)); });
        const mine = names.filter(n => n.startsWith(M));
        expect(mine.length).toBeGreaterThan(0);
        expect(mine.every(n => n === brA.name)).toBe(true);
    });
});
