const User = require('../../users/models/userModel.js');
const Contract = require('../../contracts/models/contractModel.js');
const Payroll = require('../models/payrollModel.js');
const Branch = require('../../crm/models/branchModel.js');
const Violation = require('../../crm/models/violationModel.js');
const payrollService = require('../services/payrollService');
const systemSettingsService = require('../../platform/services/systemSettingsService');

const { getPagination } = require('../../../utils/paginationHelper');

// Rp15/8 (158.xlsx): 1 NGUỒN CHUẨN — mọi màn hình gọi payrollService.calculateStaffCommission.
// Trả về shape tương thích với các caller cũ + đủ 3 khoản tách riêng.
async function computeStaffCommission(staff, startOfMonth, endOfMonth, settings) {
    const r = await payrollService.calculateStaffCommission(staff, startOfMonth, endOfMonth, { settings });
    return {
        commission: r.totalCommission,
        teachingCommission: r.teachingCommission,
        timesheetCommission: r.timesheetCommission,
        salesCommission: r.salesCommission,
        teachingSource: r.teaching.mode,
        commissionSource: r.teaching.mode,
        contractCommission: r.teaching.contractTeachingCommission,
        taughtCount: r.teaching.taughtSessionCount,
        shiftCount: r.teaching.approvedShiftCount,
        salesContractCount: r.sales.eligibleContractCount,
        salesNet: r.sales.netAmount,
        salesRate: r.sales.rate,
        ptRate: r.teaching.ptRate,
        // detailCount giữ cho tương thích; UI mới dùng các count tách riêng
        detailCount: r.teaching.taughtSessionCount + r.teaching.approvedShiftCount + r.sales.eligibleContractCount,
        warnings: r.warnings
    };
}
exports._computeStaffCommission = computeStaffCommission;

async function buildPayrollRow(staff, month, year) {
            let commission = 0;
            let detailCount = 0;

            const startOfMonth = new Date(year, month - 1, 1);
            // QA1: trọn ms cuối tháng (23:59:59.999) — trước đây .000 bỏ sót 999ms cuối
            const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

            const computed = await computeStaffCommission(staff, startOfMonth, endOfMonth);
            commission = computed.commission;
            detailCount = computed.detailCount;

            const pendingViolations = await Violation.find({
                staff: staff._id,
                status: 'Pending',
                date: { $gte: startOfMonth, $lte: endOfMonth }
            });
            const totalPendingPenalty = pendingViolations.reduce((sum, v) => sum + (v.penaltyAmount || 0), 0);

            let period1 = await Payroll.findOne({ staff: staff._id, month, year, period: 1 });
            let period2 = await Payroll.findOne({ staff: staff._id, month, year, period: 2 });

            const baseSalary = staff.baseSalary || 5000000;
            const halfBase = Math.round(baseSalary / 2);
            const halfCommission = Math.round(commission / 2);
            const halfPenalty = Math.round(totalPendingPenalty / 2);

            // Rp15/8 (158.xlsx ISSUE 2/4): record PENDING có snapshot LỆCH số hiện tại (HĐ Paid/timesheet
            // phát sinh SAU khi tạo kỳ lương — đúng ca mkt148/pt148 trên prod) → tự refresh khi mở bảng lương.
            // Paid/Applied bất biến. Ghi commissionCalculatedAt để kế toán biết số mới tính lúc nào.
            const expected = {
                teaching: Math.round((computed.teachingCommission || 0) / 2),
                timesheet: Math.round((computed.timesheetCommission || 0) / 2),
                sales: Math.round((computed.salesCommission || 0) / 2)
            };
            const stale = (r) => r && r.status === 'Pending' && (
                (r.teachingCommission || 0) !== expected.teaching ||
                (r.timesheetCommission || 0) !== expected.timesheet ||
                (r.salesCommission || 0) !== expected.sales ||
                (r.commission || 0) !== halfCommission
            );
            if (stale(period1) || stale(period2)) {
                try {
                    await payrollService.generateBiMonthlyPayroll(staff, commission, month, year, {
                        teaching: computed.teachingCommission || 0,
                        timesheet: computed.timesheetCommission || 0,
                        sales: computed.salesCommission || 0
                    });
                    period1 = await Payroll.findOne({ staff: staff._id, month, year, period: 1 });
                    period2 = await Payroll.findOne({ staff: staff._id, month, year, period: 2 });
                } catch (e) {
                    console.warn('[Payroll] auto-refresh Pending thất bại:', e.message);
                }
            }

            return {
                staff,
                commission,
                teachingCommission: computed.teachingCommission || 0,
                timesheetCommission: computed.timesheetCommission || 0,
                teachingSource: computed.teachingSource || 'contract',
                salesCommission: computed.salesCommission || 0,
                halfTeaching: Math.round((computed.teachingCommission || 0) / 2),
                halfTimesheet: Math.round((computed.timesheetCommission || 0) / 2),
                halfSales: Math.round((computed.salesCommission || 0) / 2),
                // Rp15/8: count tách riêng theo loại — không còn "N đơn vị" mơ hồ
                taughtCount: computed.taughtCount || 0,
                shiftCount: computed.shiftCount || 0,
                salesContractCount: computed.salesContractCount || 0,
                salesRate: computed.salesRate,
                ptRate: computed.ptRate,
                warnings: computed.warnings || [],
                detailCount,
                commissionSource: computed.commissionSource,
                contractCommission: computed.contractCommission,
                timesheetCommission: computed.timesheetCommission,
                baseSalary,
                halfBase,
                halfCommission,
                pendingPenalty: totalPendingPenalty,
                halfPenalty,
                period1,
                period2,
                totalEstimate: baseSalary + commission - totalPendingPenalty
            };
}

function summarizePayrollData(payrollData) {
    const stats = {
        totalBaseSalary: 0,
        totalCommission: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        staffCount: payrollData.length
    };
    payrollData.forEach((p) => {
        stats.totalBaseSalary += p.baseSalary;
        stats.totalCommission += p.commission;
        [p.period1, p.period2].forEach((rec) => {
            if (rec) {
                if (rec.status === 'Paid') stats.totalPaid += rec.totalSalary;
                else stats.totalUnpaid += rec.totalSalary;
            } else {
                stats.totalUnpaid += p.halfBase + p.halfCommission - p.halfPenalty;
            }
        });
    });
    return stats;
}

exports.getPayrollSummary = async (req, res, next) => {
    try {
        const now = new Date();
        const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);
        const year = parseInt(req.query.year, 10) || now.getFullYear();
        const roleFilter = req.query.role || 'All';
        const payStatus = req.query.payStatus || 'all';
        const branchFilter = req.query.branchId || 'all';
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let staffQuery = {
            role: { $in: ['Sales', 'PT', 'Manager', 'Admin', 'Accountant', 'Marketing'] },
            status: 'Active'
        };
        if (roleFilter !== 'All') {
            staffQuery.role = roleFilter;
        }
        if (req.session.user.role === 'Manager') {
            // QA1 (fail-closed): Manager chưa gán chi nhánh → không thấy ai, không được xem toàn hệ thống
            staffQuery.branch = req.session.user.branch || null;
        } else if (branchFilter && branchFilter !== 'all') {
            staffQuery.branch = branchFilter;
        }

        const allStaff = await User.find(staffQuery).sort({ name: 1 });
        const allPayrollData = await Promise.all(
            allStaff.map((staff) => buildPayrollRow(staff, month, year))
        );

        let filteredPayrollData = allPayrollData;
        if (payStatus === 'paid') {
            filteredPayrollData = allPayrollData.filter(
                (p) => p.period1?.status === 'Paid' && p.period2?.status === 'Paid'
            );
        } else if (payStatus === 'pending') {
            filteredPayrollData = allPayrollData.filter(
                (p) => !p.period1 || p.period1.status !== 'Paid' || !p.period2 || p.period2.status !== 'Paid'
            );
        }

        const summaryStats = summarizePayrollData(allPayrollData);
        const totalDocs = filteredPayrollData.length;
        const payrollData = filteredPayrollData.slice(skip, skip + limit);

        const pagination = getPagination(totalDocs, page, limit);
        const branches = await Branch.find({ status: 'Open' });
        const settings = await systemSettingsService.getGlobalSettings();

        res.render('admin/payroll/summary', {
            payrollData,
            summaryStats,
            pagination,
            month,
            year,
            role: roleFilter,
            payStatus,
            branchId: branchFilter,
            branches,
            isManager: req.session.user.role === 'Manager',
            activePage: 'payroll',
            query: req.query,
            ptPayrollMode: settings.ptPayrollMode || 'contract',
            timesheetRatePerShift: settings.timesheetRatePerShift ?? 120000
        });
    } catch (err) {
        next(err);
    }
};

exports.finalizePayroll = async (req, res, next) => {
    try {
        const { staffId, month, year, commission } = req.body;

        const staff = await User.findById(staffId);
        if (!staff) throw new Error('Nhân viên không tồn tại');

        const totalCommission = Number(commission) || 0;

        // Rp27/7 A2: tính lại split dạy/sale tại thời điểm chốt để lưu snapshot vào record
        const som = new Date(Number(year), Number(month) - 1, 1);
        const eom = new Date(Number(year), Number(month), 0, 23, 59, 59, 999); // QA2: trọn ms cuối tháng
        const computedSplit = await computeStaffCommission(staff, som, eom);
        const records = await payrollService.generateBiMonthlyPayroll(staff, totalCommission, Number(month), Number(year), {
            teaching: computedSplit.teachingCommission || 0,
            timesheet: computedSplit.timesheetCommission || 0,
            sales: computedSplit.salesCommission || 0
        });

        req.flash('success_msg', `Đã tạo ${records.length} kỳ lương cho ${staff.name} (Kỳ 1: ngày 5, Kỳ 2: ngày 15).`);
        res.redirect(`/admin/payroll?month=${month}&year=${year}`);
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/payroll');
    }
};

exports.autoSuggestPayroll = async (req, res, next) => {
    try {
        const now = new Date();
        const month = parseInt(req.body.month) || (now.getMonth() + 1);
        const year = parseInt(req.body.year) || now.getFullYear();

        const autoQuery = {
            role: { $in: ['Sales', 'PT', 'Manager', 'Admin', 'Accountant', 'Marketing'] },
            status: 'Active'
        };
        // QA1 (fail-closed): Manager chỉ đề xuất/tính lại cho chi nhánh mình; chưa gán chi nhánh → không ai
        if (req.session.user.role === 'Manager') autoQuery.branch = req.session.user.branch || null;
        const staffList = await User.find(autoQuery);

        let createdCount = 0;
        for (const staff of staffList) {
            let commission = 0;
            const startOfMonth = new Date(year, month - 1, 1);
            // QA1: trọn ms cuối tháng (23:59:59.999) — trước đây .000 bỏ sót 999ms cuối
            const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

            const computed = await computeStaffCommission(staff, startOfMonth, endOfMonth);
            commission = computed.commission;

            const records = await payrollService.generateBiMonthlyPayroll(staff, commission, month, year, {
                teaching: computed.teachingCommission || 0,
                timesheet: computed.timesheetCommission || 0,
                sales: computed.salesCommission || 0
            });
            createdCount += records.length;

            if (records.length > 0 && staff.role === 'PT') {
                await payrollService.applyViolationsToPaid(staff._id, month, year);
            }
        }

        req.flash('success_msg', `Đã tạo ${createdCount} bản ghi lương tự động cho Tháng ${month}/${year}.`);
        res.redirect(`/admin/payroll?month=${month}&year=${year}`);
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/payroll');
    }
};

exports.markAsPaid = async (req, res, next) => {
    try {
        const { bonus, tax, insurance, deductions, note } = req.body;

        const payroll = await Payroll.findById(req.params.id).populate('staff', 'name');
        if (!payroll) throw new Error('Không tìm thấy bản ghi lương');

        const totalBonus = Number(bonus) || 0;
        const totalTax = Number(tax) || 0;
        const totalInsurance = Number(insurance) || 0;
        const otherDeductions = Number(deductions) || 0;
        
        const sumDeductions = totalTax + totalInsurance + otherDeductions;

        payroll.bonus = totalBonus;
        payroll.tax = totalTax;
        payroll.insurance = totalInsurance;
        payroll.deductions = sumDeductions;
        payroll.note = note || '';
        payroll.totalSalary = (payroll.baseSalary || 0) + (payroll.commission || 0) + payroll.bonus - payroll.deductions;
        payroll.status = 'Paid';
        payroll.paymentDate = new Date();
        await payroll.save();

        if (payroll.deductions > 0 && payroll.period === 2) {
            await payrollService.applyViolationsToPaid(payroll.staff, payroll.month, payroll.year);
        }

        req.flash('success_msg', `Đã xác nhận thanh toán Kỳ ${payroll.period} cho ${payroll.staff.name || 'nhân viên'} thành công.`);
        res.redirect(`/admin/payroll?month=${payroll.month}&year=${payroll.year}`);
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect('/admin/payroll');
    }
};

/* ============================================================================
 * Rp15/8 (158.xlsx ISSUE 5): EXPORT — 1 hàm build rows dùng chung cho CSV + XLSX.
 * - Áp dụng đúng filter đang chọn (role/branch/payStatus) như màn summary.
 * - Cột: Nhân viên, Email, Vai trò, Chi nhánh, Tháng/Năm, Kỳ, Ngày TT, Lương cứng, Số buổi dạy,
 *   HH dạy, Số ca trực, Thù lao ca trực, Số HĐ sale, Doanh thu net sale, HH sale, Thưởng, Khấu trừ,
 *   Thực nhận, Trạng thái, Ngày trả, Ghi chú.
 * - Tiền là NUMBER (không chuỗi); XLSX numFmt '#,##0'; CSV raw number để máy đọc/parse được.
 * - Khấu trừ chưa chốt dùng penaltyAmount (đồng nhất với summary; trước đây dùng fineAmount → sai).
 * - Chống formula injection: text bắt đầu bằng = + - @ được thêm dấu nháy đơn.
 * ========================================================================== */
async function buildPayrollExportRows(req) {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const roleFilter = req.query.role || 'All';
    const payStatus = req.query.payStatus || 'all';
    const branchFilter = req.query.branchId || 'all';

    const staffQuery = {
        role: { $in: ['Sales', 'PT', 'Manager', 'Admin', 'Accountant', 'Marketing'] },
        status: 'Active'
    };
    if (roleFilter !== 'All') staffQuery.role = roleFilter;
    if (req.session.user.role === 'Manager') {
        // QA1 (fail-closed): Manager chưa gán chi nhánh → export rỗng, không lộ toàn hệ thống
        staffQuery.branch = req.session.user.branch || null;
    } else if (branchFilter && branchFilter !== 'all') {
        staffQuery.branch = branchFilter;
    }

    const staffList = await User.find(staffQuery).populate('branch', 'name').sort({ name: 1 });
    const roleMap = { PT: 'Huấn luyện viên', Sales: 'Kinh doanh', Manager: 'Quản lý', Marketing: 'Marketing', Admin: 'Admin', Accountant: 'Kế toán' };
    const rows = [];

    let allRows = await Promise.all(staffList.map((staff) => buildPayrollRow(staff, month, year)));
    if (payStatus === 'paid') {
        allRows = allRows.filter((p) => p.period1?.status === 'Paid' && p.period2?.status === 'Paid');
    } else if (payStatus === 'pending') {
        allRows = allRows.filter((p) => !p.period1 || p.period1.status !== 'Paid' || !p.period2 || p.period2.status !== 'Paid');
    }

    for (const p of allRows) {
        const staff = p.staff;
        for (const periodNum of [1, 2]) {
            const record = periodNum === 1 ? p.period1 : p.period2;
            const payDay = periodNum === 1 ? 5 : 15;
            let payMonth = month + 1, payYear = year;
            if (payMonth > 12) { payMonth = 1; payYear++; }
            const payDate = record && record.suggestedPayDate ? new Date(record.suggestedPayDate) : new Date(payYear, payMonth - 1, payDay);

            // snapshot record (đã refresh nếu Pending) — fallback ước tính hiện tại
            let teach = p.halfTeaching, shift = p.halfTimesheet, sale = p.halfSales;
            if (record && (record.teachingCommission != null || record.salesCommission != null || record.timesheetCommission != null)) {
                teach = record.teachingCommission || 0;
                shift = record.timesheetCommission || 0;
                sale = record.salesCommission || 0;
            }
            const base = record ? record.baseSalary : p.halfBase;
            const bonus = record ? (record.bonus || 0) : 0;
            const deduct = record ? (record.deductions || 0) : p.halfPenalty;
            const total = record ? record.totalSalary : Math.max(0, p.halfBase + p.halfCommission - p.halfPenalty);
            const statusText = record ? (record.status === 'Paid' ? 'Đã thanh toán' : 'Chờ trả') : 'Chưa đề xuất';

            rows.push({
                name: staff.name,
                email: (staff.email && !String(staff.email).includes(':')) ? staff.email : '',
                role: roleMap[staff.role] || staff.role,
                branch: staff.branch && staff.branch.name ? staff.branch.name : '',
                monthYear: `${month}/${year}`,
                period: `Kỳ ${periodNum}`,
                payDate,
                baseSalary: Math.round(base),
                taughtCount: p.taughtCount || 0,
                teachingCommission: Math.round(teach),
                shiftCount: p.shiftCount || 0,
                timesheetCommission: Math.round(shift),
                salesContractCount: p.salesContractCount || 0,
                salesCommission: Math.round(sale),
                bonus: Math.round(bonus),
                deductions: Math.round(deduct),
                totalSalary: Math.round(total),
                status: statusText,
                paidAt: record && record.paymentDate ? new Date(record.paymentDate) : null,
                note: record ? (record.note || '') : ''
            });
        }
    }
    return { rows, month, year };
}

// chống formula injection trong text cell (=SUM(...), +cmd, -x, @x)
function safeText(v) {
    const t = v == null ? '' : String(v);
    return /^[=+\-@]/.test(t) ? "'" + t : t;
}

const EXPORT_COLUMNS = [
    { header: 'Nhân viên', key: 'name', width: 24, text: true },
    { header: 'Email', key: 'email', width: 26, text: true },
    { header: 'Vai trò', key: 'role', width: 16, text: true },
    { header: 'Chi nhánh', key: 'branch', width: 22, text: true },
    { header: 'Tháng/Năm', key: 'monthYear', width: 11, text: true },
    { header: 'Kỳ', key: 'period', width: 8, text: true },
    { header: 'Ngày thanh toán', key: 'payDate', width: 16, date: true },
    { header: 'Lương cứng', key: 'baseSalary', width: 14, money: true },
    { header: 'Số buổi dạy (tháng)', key: 'taughtCount', width: 13 },
    { header: 'Hoa hồng dạy', key: 'teachingCommission', width: 14, money: true },
    { header: 'Số ca trực (tháng)', key: 'shiftCount', width: 12 },
    { header: 'Thù lao ca trực', key: 'timesheetCommission', width: 15, money: true },
    { header: 'Số HĐ sale (tháng)', key: 'salesContractCount', width: 12 },
    { header: 'Hoa hồng sale', key: 'salesCommission', width: 14, money: true },
    { header: 'Thưởng', key: 'bonus', width: 12, money: true },
    { header: 'Khấu trừ', key: 'deductions', width: 12, money: true },
    { header: 'Thực nhận', key: 'totalSalary', width: 14, money: true },
    { header: 'Trạng thái', key: 'status', width: 14, text: true },
    { header: 'Ngày trả', key: 'paidAt', width: 14, date: true },
    { header: 'Ghi chú', key: 'note', width: 40, text: true }
];

exports.exportPayrollCSV = async (req, res, next) => {
    try {
        const { rows, month, year } = await buildPayrollExportRows(req);
        const cols = EXPORT_COLUMNS;
        const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
        const fmtDate = (d) => d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '';
        const lines = [cols.map(c => esc(c.header)).join(',')];
        for (const r of rows) {
            lines.push(cols.map(c => {
                const v = r[c.key];
                if (c.date) return esc(fmtDate(v));
                if (c.text) return esc(safeText(v));
                return v == null ? '' : String(v); // raw number — parse được
            }).join(','));
        }
        const BOM = '\uFEFF';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="BangLuong_T${month}_${year}.csv"`);
        res.send(BOM + lines.join('\n'));
    } catch (err) {
        next(err);
    }
};

exports.exportPayrollXLSX = async (req, res, next) => {
    try {
        const ExcelJS = require('exceljs');
        const { rows, month, year } = await buildPayrollExportRows(req);
        const wb = new ExcelJS.Workbook();
        wb.creator = 'FitCity ERP';
        const ws = wb.addWorksheet(`Bang luong T${month}-${year}`);
        const cols = EXPORT_COLUMNS;
        ws.columns = cols.map(c => ({ header: c.header, key: c.key, width: c.width }));
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cols.forEach(c => {
            if (c.money) ws.getColumn(c.key).numFmt = '#,##0';
            if (c.date) ws.getColumn(c.key).numFmt = 'dd/mm/yyyy';
        });
        for (const r of rows) {
            const out = {};
            cols.forEach(c => { out[c.key] = c.text ? safeText(r[c.key]) : r[c.key]; });
            ws.addRow(out);
        }
        // Dòng tổng — công thức SUM thật để kế toán đối soát
        if (rows.length) {
            const last = ws.rowCount;
            const sumRow = ws.addRow({ name: 'TỔNG CỘNG' });
            cols.forEach((c, idx) => {
                if (c.money) {
                    const col = ws.getColumn(idx + 1).letter;
                    sumRow.getCell(idx + 1).value = { formula: `SUM(${col}2:${col}${last})` };
                }
            });
            sumRow.font = { bold: true };
        }
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.autoFilter = { from: 'A1', to: `${ws.getColumn(cols.length).letter}1` };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="BangLuong_T${month}_${year}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};
exports._buildPayrollExportRows = buildPayrollExportRows;

