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

    // Use paidAt for commission period — contract paid this month gets commission this month.
    // Fallback to updatedAt for contracts without paidAt (legacy data).
    const contracts = await Contract.find({
        pt: staffId,
        paymentStatus: 'Paid',
        $or: [
            { paidAt: { $gte: startOfMonth, $lte: endOfMonth } },
            { paidAt: { $exists: false }, updatedAt: { $gte: startOfMonth, $lte: endOfMonth } }
        ]
    });
    const contractCommission = exports.calculatePTCommissionFromContracts(contracts);
    const timesheetCommission = await exports.calculatePTCommissionFromTimesheets(
        staffId,
        month,
        year,
        rate
    );
    const timesheetShifts = await timesheetService.countApprovedShifts(staffId, month, year);

    if (mode === 'timesheet') {
        return {
            commission: timesheetCommission,
            detailCount: timesheetShifts,
            commissionSource: 'timesheet',
            contractCommission,
            timesheetCommission
        };
    }
    if (mode === 'hybrid') {
        return {
            commission: Math.round((contractCommission + timesheetCommission) / 2),
            detailCount: contracts.length + timesheetShifts,
            commissionSource: 'hybrid',
            contractCommission,
            timesheetCommission
        };
    }
    return {
        commission: contractCommission,
        detailCount: contracts.length,
        commissionSource: 'contract',
        contractCommission,
        timesheetCommission
    };
};

/** Sales/Manager: % trên netAmount */
exports.calculateSalesCommission = (contracts = [], rate = 0) => {
    const totalNet = contracts.reduce((sum, contract) => sum + contractNetAmount(contract), 0);
    return Math.round(totalNet * (rate / 100));
};

exports.calculateTotalSalary = (baseSalary = 0, commission = 0, bonus = 0, deductions = 0) => {
    const total = baseSalary + commission + bonus - deductions;
    return Math.max(0, total);
};

const Violation = require('../../crm/models/violationModel.js');

exports.generateBiMonthlyPayroll = async (staff, commission = 0, month, year) => {
    const halfBase = Math.round((staff.baseSalary || 5000000) / 2);
    const halfCommission = Math.round(commission / 2);
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

