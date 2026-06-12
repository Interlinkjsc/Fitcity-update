const Contract = require('../../../modules/contracts/models/contractModel');
const WorkoutSession = require('../../programs/models/workoutSessionModel');
const KPIConfig = require('../../programs/models/kpiModel');
const EmployeeKPITarget = require('../../programs/models/employeeKpiTargetModel');
const Lead = require('../../crm/models/leadModel');
const { NET_AMOUNT_EXPR } = require('../../../modules/contracts/services/contractScopeService');
const payrollService = require('../../finance/services/payrollService');
const mongoose = require('mongoose');

/**
 * Helper: get month/year from a Date or default to current.
 */
function getPeriod(date, monthOverride, yearOverride) {
    const d = date ? new Date(date) : new Date();
    return {
        month: monthOverride ?? (d.getMonth() + 1),
        year: yearOverride ?? d.getFullYear()
    };
}

/**
 * Build a date range filter for a given month/year.
 */
function monthRangeFilter(month, year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return { createdAt: { $gte: start, $lt: end } };
}

function resolveEmployeeTargets(employeeTarget, branchConfig) {
    return {
        revenueTarget: employeeTarget?.revenueTarget ?? branchConfig?.revenueTarget ?? 0,
        contractTarget: employeeTarget?.contractTarget ?? branchConfig?.contractTarget ?? 0,
        newLeadTarget: employeeTarget?.newLeadTarget ?? branchConfig?.newLeadTarget ?? 0,
        sessionTarget: employeeTarget?.sessionTarget ?? 0,
        targetSource: employeeTarget ? 'employee' : (branchConfig ? 'branch' : 'none')
    };
}

async function getEmployeeKPITargetRecord(staffId, month, year) {
    return EmployeeKPITarget.findOne({ staff: staffId, month, year }).lean();
}

async function saveEmployeeKPITarget(staffId, data, createdBy) {
    const month = Number(data.month ?? data.kpiMonth);
    const year = Number(data.year ?? data.kpiYear);
    const { revenueTarget, contractTarget, newLeadTarget, sessionTarget, notes } = data;
    return EmployeeKPITarget.findOneAndUpdate(
        { staff: staffId, month, year },
        {
            revenueTarget: Number(revenueTarget) || 0,
            contractTarget: Number(contractTarget) || 0,
            newLeadTarget: Number(newLeadTarget) || 0,
            sessionTarget: Number(sessionTarget) || 0,
            notes: notes || '',
            createdBy
        },
        { upsert: true, new: true, runValidators: true }
    );
}

/**
 * Get KPI performance for a single branch.
 * Returns: { branchId, branchName, revenueTarget, revenueActual, revenuePercent,
 *            contractTarget, contractActual, newLeadTarget, newLeadActual }
 */
async function getBranchKPI(branch, monthOverride, yearOverride) {
    const { month, year } = getPeriod(null, monthOverride, yearOverride);
    const dateFilter = monthRangeFilter(month, year);

    const config = await KPIConfig.findOne({ branch: branch._id, month, year });

    // Contract count actual (non-cancelled contracts created this month)
    const contractActual = await Contract.countDocuments({
        branch: branch._id,
        ...dateFilter,
        contractStatus: { $ne: 'Cancelled' }
    });

    // Lead count actual (leads created this month)
    const leadActual = await Lead.countDocuments({
        branch: branch._id,
        ...dateFilter
    });

    // Revenue actual = sum(netAmount) for non-cancelled contracts this month
    const revenueResult = await Contract.aggregate([
        { $match: { branch: branch._id, ...dateFilter, contractStatus: { $ne: 'Cancelled' } } },
        { $group: { _id: null, totalNet: { $sum: NET_AMOUNT_EXPR } } }
    ]);

    const revenueActual = revenueResult[0]?.totalNet || 0;
    const revenueTarget = config?.revenueTarget || 0;
    const contractTargetVal = config?.contractTarget || 0;
    const newLeadTarget = config?.newLeadTarget || 0;

    return {
        branchId: branch._id,
        branchName: branch.name,
        revenueTarget,
        revenueActual: Math.round(revenueActual),
        revenuePercent: revenueTarget > 0 ? Math.round((revenueActual / revenueTarget) * 100) : 0,
        contractTarget: contractTargetVal,
        contractActual,
        contractPercent: contractTargetVal > 0 ? Math.round((contractActual / contractTargetVal) * 100) : 0,
        newLeadTarget,
        newLeadActual: leadActual,
        leadPercent: newLeadTarget > 0 ? Math.round((leadActual / newLeadTarget) * 100) : 0
    };
}

/**
 * Get KPI performance for a Sales employee.
 * Returns: { userId, name, revenueActual, contractActual, contractTarget, contractPercent,
 *            newLeadActual, newLeadTarget, leadPercent }
 */
async function getSalesKPI(user, monthOverride, yearOverride) {
    const { month, year } = getPeriod(null, monthOverride, yearOverride);
    const dateFilter = monthRangeFilter(month, year);

    const revenueResult = await Contract.aggregate([
        { $match: { sales: user._id, ...dateFilter, contractStatus: { $ne: 'Cancelled' } } },
        { $group: { _id: null, totalNet: { $sum: NET_AMOUNT_EXPR }, count: { $sum: 1 } } }
    ]);

    const branchConfig = user.branch
        ? await KPIConfig.findOne({ branch: user.branch, month, year }).lean()
        : null;
    const employeeTarget = await getEmployeeKPITargetRecord(user._id, month, year);
    const targets = resolveEmployeeTargets(employeeTarget, branchConfig);

    const leadActual = await Lead.countDocuments({
        ...(user.branch ? { branch: user.branch } : {}),
        ...dateFilter,
        ...(user.role === 'Sales' ? { assignedTo: user._id } : {})
    });

    const revenueActual = Math.round(revenueResult[0]?.totalNet || 0);
    const contractActual = revenueResult[0]?.count || 0;

    return {
        userId: user._id,
        name: user.name,
        revenueActual,
        contractActual,
        contractTarget: targets.contractTarget,
        contractPercent: targets.contractTarget
            ? Math.round((contractActual / targets.contractTarget) * 100)
            : 0,
        newLeadActual: leadActual,
        newLeadTarget: targets.newLeadTarget,
        leadPercent: targets.newLeadTarget
            ? Math.round((leadActual / targets.newLeadTarget) * 100)
            : 0,
        revenueTarget: targets.revenueTarget,
        revenuePercent: targets.revenueTarget
            ? Math.round((revenueActual / targets.revenueTarget) * 100)
            : 0,
        targetSource: targets.targetSource
    };
}

/**
 * Get KPI performance for a PT employee.
 * Returns: { userId, name, sessionCount, workingDays, commission, ptCommissionRate,
 *            newContractRevenue, revenueTarget, revenuePercent }
 */
async function getPTKPI(user, monthOverride, yearOverride) {
    const { month, year } = getPeriod(null, monthOverride, yearOverride);
    const dateFilter = monthRangeFilter(month, year);

    // Completed sessions this month
    const sessionResult = await WorkoutSession.aggregate([
        { $match: { pt: user._id, status: 'Completed', ...dateFilter } },
        {
            $group: {
                _id: null,
                sessionCount: { $sum: 1 },
                workingDays: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } } }
            }
        }
    ]);

    // Revenue from new contracts this month where user is PT
    const revenueResult = await Contract.aggregate([
        { $match: { pt: user._id, ...dateFilter, contractStatus: { $ne: 'Cancelled' } } },
        { $group: { _id: null, totalNet: { $sum: NET_AMOUNT_EXPR } } }
    ]);

    // Branch KPI config for target
    const branchConfig = user.branch
        ? await KPIConfig.findOne({ branch: user.branch, month, year }).lean()
        : null;
    const employeeTarget = await getEmployeeKPITargetRecord(user._id, month, year);
    const targets = resolveEmployeeTargets(employeeTarget, branchConfig);

    const sessionCount = sessionResult[0]?.sessionCount || 0;
    const workingDays = sessionResult[0]?.workingDays?.length || 0;
    const paidContracts = await Contract.find({
        pt: user._id,
        paymentStatus: 'Paid',
        ...dateFilter
    }).select('ptCommission netAmount basePrice discount').lean();
    const commission = payrollService.calculatePTCommissionFromContracts(paidContracts);
    const newContractRevenue = Math.round(revenueResult[0]?.totalNet || 0);

    return {
        userId: user._id,
        name: user.name,
        sessionCount,
        workingDays,
        commission,
        paidContractCount: paidContracts.length,
        newContractRevenue,
        revenueTarget: targets.revenueTarget,
        revenuePercent: targets.revenueTarget > 0
            ? Math.round((newContractRevenue / targets.revenueTarget) * 100)
            : 0,
        sessionTarget: targets.sessionTarget,
        sessionPercent: targets.sessionTarget > 0
            ? Math.round((sessionCount / targets.sessionTarget) * 100)
            : 0,
        targetSource: targets.targetSource
    };
}

/**
 * Get KPI performance for a Manager's branch staff.
 * Returns: { sales: [...], pt: [...] }
 */
async function getBranchStaffKPIs(branchId, monthOverride, yearOverride) {
    const User = require('../../users/models/userModel');

    const { month, year } = getPeriod(null, monthOverride, yearOverride);

    // Get all Sales and PT in this branch
    const salesStaff = await User.find({ branch: branchId, role: 'Sales', status: 'Active' }).lean();
    const ptStaff = await User.find({ branch: branchId, role: 'PT', status: 'Active' }).lean();

    const salesKPI = await Promise.all(salesStaff.map(s => getSalesKPI(s, month, year)));
    const ptKPI = await Promise.all(ptStaff.map(p => getPTKPI(p, month, year)));

    return { sales: salesKPI, pt: ptKPI };
}

/**
 * Get comprehensive KPI for a single employee (any role).
 * For Manager: returns branch overview + staff list.
 * For Sales: returns sales KPI.
 * For PT: returns PT KPI.
 */
async function getEmployeeKPI(user, monthOverride, yearOverride) {
    const { month, year } = getPeriod(null, monthOverride, yearOverride);

    if (user.role === 'PT') {
        return await getPTKPI(user, month, year);
    }
    if (user.role === 'Sales') {
        return await getSalesKPI(user, month, year);
    }
    if (user.role === 'Manager' && user.branch) {
        const branch = await require('../../crm/models/branchModel').findById(user.branch).lean();
        const branchKPI = branch ? await getBranchKPI(branch, month, year) : null;
        const staffKPIs = await getBranchStaffKPIs(user.branch, month, year);
        return { branch: branchKPI, staff: staffKPIs };
    }
    return null;
}

module.exports = {
    getBranchKPI,
    getSalesKPI,
    getPTKPI,
    getBranchStaffKPIs,
    getEmployeeKPI,
    getEmployeeKPITargetRecord,
    saveEmployeeKPITarget,
    resolveEmployeeTargets
};
