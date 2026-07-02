const User = require('../../users/models/userModel.js');
const Contract = require('../../contracts/models/contractModel.js');
const Payroll = require('../models/payrollModel.js');
const Branch = require('../../crm/models/branchModel.js');
const Violation = require('../../crm/models/violationModel.js');
const payrollService = require('../services/payrollService');
const systemSettingsService = require('../../platform/services/systemSettingsService');

const { getPagination } = require('../../../utils/paginationHelper');

async function computeStaffCommission(staff, startOfMonth, endOfMonth) {
    if (staff.role === 'PT') {
        const resolved = await payrollService.resolvePTPayrollCommission(
            staff._id,
            startOfMonth,
            endOfMonth
        );
        return {
            commission: resolved.commission,
            detailCount: resolved.detailCount,
            commissionSource: resolved.commissionSource,
            contractCommission: resolved.contractCommission,
            timesheetCommission: resolved.timesheetCommission
        };
    }
    if (staff.role === 'Sales' || staff.role === 'Manager') {
        const contracts = await Contract.find({
            sales: staff._id,
            paymentStatus: 'Paid',
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        });
        const rate = staff.salesCommissionRate || 5;
        return {
            commission: payrollService.calculateSalesCommission(contracts, rate),
            detailCount: contracts.length
        };
    }
    return { commission: 0, detailCount: 0 };
}

async function buildPayrollRow(staff, month, year) {
            let commission = 0;
            let detailCount = 0;

            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59);

            const computed = await computeStaffCommission(staff, startOfMonth, endOfMonth);
            commission = computed.commission;
            detailCount = computed.detailCount;

            const pendingViolations = await Violation.find({
                staff: staff._id,
                status: 'Pending',
                date: { $gte: startOfMonth, $lte: endOfMonth }
            });
            const totalPendingPenalty = pendingViolations.reduce((sum, v) => sum + (v.penaltyAmount || 0), 0);

            const period1 = await Payroll.findOne({ staff: staff._id, month, year, period: 1 });
            const period2 = await Payroll.findOne({ staff: staff._id, month, year, period: 2 });

            const baseSalary = staff.baseSalary || 5000000;
            const halfBase = Math.round(baseSalary / 2);
            const halfCommission = Math.round(commission / 2);
            const halfPenalty = Math.round(totalPendingPenalty / 2);

            return {
                staff,
                commission,
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
            role: { $in: ['Sales', 'PT', 'Manager'] },
            status: 'Active'
        };
        if (roleFilter !== 'All') {
            staffQuery.role = roleFilter;
        }
        if (req.session.user.role === 'Manager' && req.session.user.branch) {
            staffQuery.branch = req.session.user.branch;
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

        const records = await payrollService.generateBiMonthlyPayroll(staff, totalCommission, Number(month), Number(year));

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

        const staffList = await User.find({ 
            role: { $in: ['Sales', 'PT', 'Manager'] }, 
            status: 'Active' 
        });

        let createdCount = 0;
        for (const staff of staffList) {
            let commission = 0;
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59);

            const computed = await computeStaffCommission(staff, startOfMonth, endOfMonth);
            commission = computed.commission;

            const records = await payrollService.generateBiMonthlyPayroll(staff, commission, month, year);
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

        const payroll = await Payroll.findById(req.params.id);
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

exports.exportPayrollCSV = async (req, res, next) => {
    try {
        const now = new Date();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        const year = parseInt(req.query.year) || now.getFullYear();
        const roleFilter = req.query.role || 'All';

        let query = { 
            role: { $in: ['Sales', 'PT', 'Manager'] }, 
            status: 'Active' 
        };
        if (roleFilter !== 'All') {
            query.role = roleFilter;
        }

        const staffList = await User.find(query);
        const roleMap = { 'PT': 'Huấn luyện viên', 'Sales': 'Kinh doanh', 'Manager': 'Quản lý' };
        const csvRows = [];

        for (const staff of staffList) {
            let commission = 0;
            let detailCount = 0;

            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59);

            const computed = await computeStaffCommission(staff, startOfMonth, endOfMonth);
            commission = computed.commission;
            detailCount = computed.detailCount;

            for (const periodNum of [1, 2]) {
                const record = await Payroll.findOne({ staff: staff._id, month, year, period: periodNum });
                const halfBase = Math.round((staff.baseSalary || 5000000) / 2);
                const halfComm = Math.round(commission / 2);
                
                let penalty = record ? record.deductions : 0;
                if (!record) {
                    const violations = await Violation.find({
                        staff: staff._id,
                        status: 'Pending',
                        date: { $gte: startOfMonth, $lte: endOfMonth }
                    });
                    const totalPenalty = violations.reduce((sum, v) => sum + (v.fineAmount || 0), 0);
                    penalty = Math.round(totalPenalty / 2);
                }

                const statusText = record ? (record.status === 'Paid' ? 'Đã thanh toán' : 'Chưa thanh toán') : 'Chưa đề xuất';
                const payDay = periodNum === 1 ? 5 : 15;
                const halfCount = Math.round((detailCount / 2) * 10) / 10;

                csvRows.push(
                    `"${staff.name}","${roleMap[staff.role] || staff.role}",Kỳ ${periodNum} (ngày ${payDay}),${record ? record.baseSalary : halfBase},${halfCount},${record ? record.commission : halfComm},${record ? record.bonus || 0 : 0},${penalty},${record ? record.totalSalary : (halfBase + halfComm - penalty)},"${statusText}"`
                );
            }
        }

        const BOM = '\uFEFF';
        const header = 'Nhân viên,Vai trò,Kỳ lương,Lương cứng,Chỉ số hiệu suất,Hoa hồng,Thưởng,Khấu trừ,Thực nhận,Trạng thái';
        const csv = BOM + header + '\n' + csvRows.join('\n');

        const fileName = `Payroll_T${month}_${year}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(csv);
    } catch (err) {
        next(err);
    }
};

