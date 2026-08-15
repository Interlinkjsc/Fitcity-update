const Payroll = require('../models/payrollModel.js');
const Contract = require('../../contracts/models/contractModel.js');
const timesheetService = require('../../pt/services/timesheetService.js');
const systemSettingsService = require('../../platform/services/systemSettingsService.js');

exports.calculatePTCommission = (sessions = []) => {
    const validSessions = sessions.filter(session => session.status === 'Completed');
    const count = validSessions.length;
    let ratePerSession;
    if (count > 50) ratePerSession = 150000;
    else if (count >= 20) ratePerSession = 120000;
    else ratePerSession = 100000;

    return count * ratePerSession;
};

function contractNetAmount(contract) {
    if (contract.netAmount != null) return contract.netAmount;
    return (contract.basePrice || 0) - (contract.discount || 0);
}

/** PT hoa hồng: tổng ptCommission trên HĐ đã thanh toán (tính từ % netAmount lúc tạo HĐ) */
exports.calculatePTCommissionFromContracts = (contracts = []) => {
    return contracts.reduce((sum, c) => sum + (c.ptCommission || 0), 0);
};

/**
 * Bug 23/7 A17: hoa hồng DẠY của PT tính theo TỪNG BUỔI ĐÃ DẠY.
 * Mỗi buổi = ptCommissionRate% × (giá mỗi buổi của HĐ) = rate% × basePrice / totalSessions.
 * KHÔNG phụ thuộc trạng thái thanh toán — HĐ đặt cọc/chưa trả vẫn tính comm dạy.
 * "Đã dạy" = session Completed hoặc Confirmed trong kỳ.
 */
exports.calculatePTTeachingCommission = async (staffId, startOfMonth, endOfMonth, opts = {}) => {
    const WorkoutSession = require('../../programs/models/workoutSessionModel');
    const sessions = await WorkoutSession.find({
        pt: staffId,
        status: { $in: ['Completed', 'Confirmed'] },
        scheduledTime: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('contract', 'basePrice totalSessions pt packageSnapshot contractCode').lean();

    // Rp15/8: resolve rate 1 lần cho cả kỳ (không query User trong vòng lặp)
    const rate = await resolvePtRate(staffId, opts.settings);

    let commission = 0;
    let taughtCount = 0;
    let skipped = 0;
    for (const s of sessions) {
        const c = s.contract;
        if (!c) { skipped++; continue; }
        // QC review 1 (A12): HĐ legacy thiếu basePrice/totalSessions → fallback packageSnapshot,
        // và log cảnh báo thay vì âm thầm trả 0.
        const price = c.basePrice || (c.packageSnapshot && c.packageSnapshot.price) || 0;
        const totalSessions = c.totalSessions || (c.packageSnapshot && c.packageSnapshot.sessions) || 0;
        if (!price || !totalSessions) {
            console.warn(`[Payroll] HĐ ${c.contractCode || c._id} thiếu basePrice/totalSessions — buổi dạy không tính được comm`);
            skipped++;
            continue;
        }
        const pricePerSession = price / totalSessions;
        commission += Math.round(pricePerSession * rate / 100);
        taughtCount++;
    }
    return { commission, taughtCount, skipped, rate };
};

/**
 * Rp15/8: % hoa hồng dạy của PT. `??` — 0 chủ động vẫn là 0; CHƯA cấu hình (null/undefined)
 * → Settings.defaultPtCommissionRate → 10.
 * Lưu ý userModel default ptCommissionRate = 0 nên user tạo qua form luôn có số cụ thể.
 */
async function resolvePtRate(staffId, settings) {
    const User = require('../../users/models/userModel');
    const pt = await User.findById(staffId).select('ptCommissionRate').lean();
    const raw = pt ? pt.ptCommissionRate : null;
    if (raw != null && Number.isFinite(Number(raw))) {
        return Math.max(0, Math.min(100, Number(raw)));
    }
    const s = settings || await systemSettingsService.getGlobalSettings();
    const def = s && s.defaultPtCommissionRate;
    if (def != null && Number.isFinite(Number(def))) return Math.max(0, Math.min(100, Number(def)));
    return 10;
}
exports.resolvePtRate = resolvePtRate;

exports.calculatePTCommissionFromTimesheets = async (staffId, month, year, ratePerShift = 120000) => {
    const count = await timesheetService.countApprovedShifts(staffId, month, year);
    return count * ratePerShift;
};

/**
 * Tính hoa hồng PT theo cấu hình hệ thống: contract | timesheet | hybrid
 */
exports.resolvePTPayrollCommission = async (staffId, startOfMonth, endOfMonth) => {
    const settings = await systemSettingsService.getGlobalSettings();
    const month = startOfMonth.getMonth() + 1;
    const year = startOfMonth.getFullYear();
    const rate = settings.timesheetRatePerShift ?? 120000;
    const mode = settings.ptPayrollMode || 'contract';

    // Bug 23/7 A17: comm dạy = số buổi đã dạy × (rate% × giá/buổi), mọi trạng thái HĐ.
    const teaching = await exports.calculatePTTeachingCommission(staffId, startOfMonth, endOfMonth);
    const contractCommission = teaching.commission;
    const timesheetCommission = await exports.calculatePTCommissionFromTimesheets(
        staffId,
        month,
        year,
        rate
    );
    const timesheetShifts = await timesheetService.countApprovedShifts(staffId, month, year);

    // Rp15/8 (158.xlsx ISSUE 2/8): HH dạy và thù lao ca trực là 2 khoản ĐỘC LẬP, CỘNG DỒN.
    // Trước đây mode 'timesheet' THAY THẾ HH dạy bằng thù lao ca (→ PT có 2 buổi Confirmed
    // nhưng HH dạy = 0), mode 'hybrid' lấy TRUNG BÌNH — cả 2 đều sai nghiệp vụ.
    if (mode === 'timesheet' || mode === 'hybrid') {
        return {
            commission: contractCommission + timesheetCommission,
            detailCount: teaching.taughtCount + timesheetShifts,
            taughtCount: teaching.taughtCount,
            shiftCount: timesheetShifts,
            commissionSource: mode,
            contractCommission,
            timesheetCommission
        };
    }
    // 'contract' = chỉ HH dạy theo buổi
    return {
        commission: contractCommission,
        detailCount: teaching.taughtCount,
        taughtCount: teaching.taughtCount,
        shiftCount: 0,
        commissionSource: 'contract',
        contractCommission,
        timesheetCommission: 0
    };
};

/** Sales/Manager: % trên netAmount */
exports.calculateSalesCommission = (contracts = [], rate = 0) => {
    const totalNet = contracts.reduce((sum, contract) => sum + contractNetAmount(contract), 0);
    return Math.round(totalNet * (rate / 100));
};

/* ============================================================================
 * Rp 15/8 (158.xlsx) — COMMISSION ENGINE DÙNG CHUNG (nguồn chuẩn duy nhất)
 * Payroll preview/finalize, PT income, KPI, dashboard admin/manager/mkt/sales
 * ĐỀU PHẢI gọi calculateStaffCommission — không màn hình nào tự tính riêng.
 * ------------------------------------------------------------------------
 * Business rule chốt (ghi rõ trong báo cáo khách):
 *  - HH DẠY = Σ buổi Completed/Confirmed × (ptRate% × giá/buổi HĐ)
 *  - THÙ LAO CA TRỰC = số ca timesheet Approved (có checkOut) × timesheetRatePerShift
 *    → 2 khoản ĐỘC LẬP, cộng dồn. Mode ptPayrollMode chỉ quyết định khoản nào ĐƯỢC BẬT:
 *      contract  = chỉ HH dạy
 *      timesheet = HH dạy + thù lao ca trực   (trước đây thay thế HH dạy = 0 → lỗi khách báo)
 *      hybrid    = HH dạy + thù lao ca trực
 *  - HH SALE = Σ netAmount HĐ (sales = staff, paymentStatus Paid, createdAt trong kỳ) × salesRate%
 *  - Rate dùng `??` (0 chủ động ≠ chưa cấu hình); fallback ptRate = Settings.defaultPtCommissionRate.
 *  - Kỳ = [periodStart, periodEnd] theo giờ máy chủ (TZ Asia/Ho_Chi_Minh đã set trong docker).
 * ========================================================================== */

/** Query duy nhất cho HĐ sale đủ điều kiện tính hoa hồng. */
exports.findEligibleSalesContracts = async (staffId, periodStart, periodEnd) => {
    return Contract.find({
        sales: staffId,
        paymentStatus: 'Paid',
        contractStatus: { $ne: 'Cancelled' },
        createdAt: { $gte: periodStart, $lte: periodEnd }
    }).select('netAmount basePrice discount contractCode createdAt client').lean();
};

/** Resolve rate hoa hồng sale: `??` để giữ 0 chủ động; chưa cấu hình → 5%. */
exports.resolveSalesRate = (staff) => {
    const r = staff && staff.salesCommissionRate;
    if (r != null && Number.isFinite(Number(r))) return Math.max(0, Math.min(100, Number(r)));
    return 5;
};

/**
 * Nguồn chuẩn duy nhất.
 * @param {Object} staff  user doc/lean có _id, role, ptCommissionRate, salesCommissionRate
 * @param {Date} periodStart
 * @param {Date} periodEnd
 * @param {Object} [opts] { settings } để tránh query lại Settings khi gọi lặp
 */
exports.calculateStaffCommission = async (staff, periodStart, periodEnd, opts = {}) => {
    const settings = opts.settings || await systemSettingsService.getGlobalSettings();
    const mode = settings.ptPayrollMode || 'contract';
    const shiftRate = settings.timesheetRatePerShift ?? 120000;
    const warnings = [];

    // ---- Sales (mọi role đều có thể chốt HĐ) ----
    const salesRate = exports.resolveSalesRate(staff);
    const eligible = await exports.findEligibleSalesContracts(staff._id, periodStart, periodEnd);
    const salesNet = eligible.reduce((s, c) => s + contractNetAmount(c), 0);
    const salesCommission = Math.round(salesNet * salesRate / 100);

    // ---- Teaching (chỉ PT) ----
    let teaching = {
        mode,
        taughtSessionCount: 0,
        approvedShiftCount: 0,
        contractTeachingCommission: 0,
        timesheetCommission: 0,
        ptRate: null,
        shiftRate
    };
    let teachingCommission = 0;
    let timesheetCommission = 0;
    if (staff.role === 'PT') {
        const t = await exports.calculatePTTeachingCommission(staff._id, periodStart, periodEnd, { settings });
        teaching.taughtSessionCount = t.taughtCount;
        teaching.contractTeachingCommission = t.commission;
        teaching.ptRate = t.rate;
        if (t.skipped) warnings.push(`${t.skipped} buổi không tính được HH dạy (HĐ thiếu giá/số buổi)`);
        teachingCommission = t.commission;

        if (mode === 'timesheet' || mode === 'hybrid') {
            const month = periodStart.getMonth() + 1;
            const year = periodStart.getFullYear();
            const shifts = await timesheetService.countApprovedShifts(staff._id, month, year);
            teaching.approvedShiftCount = shifts;
            timesheetCommission = Math.round(shifts * shiftRate);
            teaching.timesheetCommission = timesheetCommission;
        }
    }

    return {
        teachingCommission,          // HH dạy theo buổi
        timesheetCommission,         // thù lao ca trực (0 nếu mode contract / không phải PT)
        salesCommission,
        totalCommission: teachingCommission + timesheetCommission + salesCommission,
        teaching,
        sales: {
            eligibleContractCount: eligible.length,
            netAmount: salesNet,
            rate: salesRate,
            contracts: opts.includeDetails ? eligible : undefined
        },
        warnings
    };
};

exports.calculateTotalSalary = (baseSalary = 0, commission = 0, bonus = 0, deductions = 0) => {
    const total = baseSalary + commission + bonus - deductions;
    return Math.max(0, total);
};

const Violation = require('../../crm/models/violationModel.js');

/**
 * Tạo 2 kỳ lương/tháng. Rp15/8 (158.xlsx ISSUE 2/4):
 *  - commissionSplit = { teaching, timesheet, sales } snapshot đầy đủ 3 khoản.
 *  - Record PENDING đã tồn tại → REFRESH lại snapshot theo số mới (trước đây `continue` → số cũ
 *    đóng băng, badge live "1 HĐ" nhưng cell HH sale = 0). Record PAID/Applied → BẤT BIẾN.
 *  - opts.refreshPending=false để giữ hành vi cũ nếu caller cần.
 */
exports.generateBiMonthlyPayroll = async (staff, commission = 0, month, year, commissionSplit = null, opts = {}) => {
    const refreshPending = opts.refreshPending !== false;
    const halfBase = Math.round((staff.baseSalary || 5000000) / 2);
    const halfCommission = Math.round(commission / 2);
    // Rp27/7 A2 (QC review 1): snapshot tách comm dạy/sale tại thời điểm chốt
    const halfTeaching = commissionSplit ? Math.round((commissionSplit.teaching || 0) / 2) : null;
    const halfTimesheet = commissionSplit ? Math.round((commissionSplit.timesheet || 0) / 2) : null;
    const halfSales = commissionSplit ? Math.round((commissionSplit.sales || 0) / 2) : null;
    const results = [];

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    
    const violations = await Violation.find({
        staff: staff._id,
        status: 'Pending',
        date: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const totalDeductions = violations.reduce((sum, v) => sum + (v.penaltyAmount || 0), 0);
    const halfDeductions = Math.round(totalDeductions / 2);

    const payDays = { 1: 5, 2: 15 };

    for (const period of [1, 2]) {
        const existing = await Payroll.findOne({ staff: staff._id, month, year, period });
        if (existing) {
            if (existing.status === 'Pending' && refreshPending) {
                // Refresh snapshot Pending (audit commissionCalculatedAt); giữ bonus/tax/note người dùng đã sửa
                existing.baseSalary = halfBase;
                existing.commission = halfCommission;
                if (commissionSplit) {
                    existing.teachingCommission = halfTeaching;
                    existing.timesheetCommission = halfTimesheet;
                    existing.salesCommission = halfSales;
                }
                existing.deductions = halfDeductions;
                existing.totalSalary = exports.calculateTotalSalary(halfBase, halfCommission, existing.bonus || 0, halfDeductions);
                existing.commissionCalculatedAt = new Date();
                await existing.save();
            }
            results.push(existing);
            continue;
        }

        let payMonth = month;
        let payYear = year;
        if (payMonth > 11) {
            payMonth = 0;
            payYear++;
        }
        const suggestedPayDate = new Date(payYear, payMonth, payDays[period]);
        const totalSalary = exports.calculateTotalSalary(halfBase, halfCommission, 0, halfDeductions);
        
        const displayMonth = (month % 12) + 1;
        const displayYear = (month >= 12) ? year + 1 : year;
        
        const record = await Payroll.create({
            staff: staff._id,
            month,
            year,
            period,
            baseSalary: halfBase,
            commission: halfCommission,
            teachingCommission: halfTeaching,
            timesheetCommission: halfTimesheet,
            salesCommission: halfSales,
            commissionCalculatedAt: new Date(),
            bonus: 0,
            deductions: halfDeductions,
            totalSalary,
            suggestedPayDate,
            status: 'Pending',
            note: `Lương Kỳ ${period} tháng ${month}/${year} — Dự kiến thanh toán: ${payDays[period]}/${displayMonth}/${displayYear}` + (halfDeductions > 0 ? ` (Đã khấu trừ vi phạm: ${new Intl.NumberFormat('vi-VN').format(halfDeductions)}đ)` : '')
        });
        results.push(record);
    }

    return results;
};

exports.applyViolationsToPaid = async (staffId, month, year) => {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    
    await Violation.updateMany(
        { 
            staff: staffId, 
            status: 'Pending',
            date: { $gte: startOfMonth, $lte: endOfMonth }
        },
        { status: 'Applied_To_Payroll' }
    );
};

