const mongoose = require('mongoose');
const Expense = require('../models/expenseModel');
const Payroll = require('../models/payrollModel');
const PAYROLL_CATEGORY = 'Payroll';

function totalSumGroup() {
    return { $sum: { $ifNull: ['$total', '$amount'] } };
}

/**
 * Bộ lọc ngày cho Expense (field `date`) và chi nhánh.
 */
function buildOperatingExpenseFilter({ startDate, endDate, branchId, managerBranchId } = {}) {
    const filter = {};

    if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.date.$lte = end;
        }
    }

    if (managerBranchId) {
        filter.branch = managerBranchId;
    } else if (branchId && branchId !== 'all') {
        filter.branch = new mongoose.Types.ObjectId(branchId);
    }

    return filter;
}

function buildPayrollPaymentDateFilter({ startDate, endDate } = {}) {
    if (!startDate && !endDate) return null;
    const paymentDate = {};
    if (startDate) paymentDate.$gte = new Date(startDate);
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        paymentDate.$lte = end;
    }
    return paymentDate;
}

/**
 * Tổng lương đã thanh toán (theo paymentDate), gom theo chi nhánh staff.
 */
async function aggregatePaidPayroll({ startDate, endDate, branchId, managerBranchId } = {}) {
    const paymentDate = buildPayrollPaymentDateFilter({ startDate, endDate });
    const match = { status: 'Paid' };
    if (paymentDate) match.paymentDate = paymentDate;

    const branchMatch = {};
    if (managerBranchId) {
        branchMatch['staffUser.branch'] = new mongoose.Types.ObjectId(managerBranchId);
    } else if (branchId && branchId !== 'all') {
        branchMatch['staffUser.branch'] = new mongoose.Types.ObjectId(branchId);
    }

    const pipeline = [
        { $match: match },
        {
            $lookup: {
                from: 'users',
                localField: 'staff',
                foreignField: '_id',
                as: 'staffUser'
            }
        },
        { $unwind: '$staffUser' }
    ];

    if (Object.keys(branchMatch).length) {
        pipeline.push({ $match: branchMatch });
    }

    pipeline.push({
        $group: {
            _id: '$staffUser.branch',
            total: { $sum: '$totalSalary' },
            count: { $sum: 1 }
        }
    });

    const byBranch = await Payroll.aggregate(pipeline);

    const total = byBranch.reduce((s, r) => s + (r.total || 0), 0);
    const count = byBranch.reduce((s, r) => s + (r.count || 0), 0);

    return { total, count, byBranch };
}

async function aggregateOperatingExpenses(expenseFilter) {
    const totalResult = await Expense.aggregate([
        { $match: expenseFilter },
        { $group: { _id: null, total: totalSumGroup(), count: { $sum: 1 } } }
    ]);

    const categoryBreakdown = await Expense.aggregate([
        { $match: expenseFilter },
        { $group: { _id: '$category', total: totalSumGroup(), count: { $sum: 1 } } },
        { $sort: { total: -1 } }
    ]);

    const branchBreakdown = await Expense.aggregate([
        { $match: expenseFilter },
        { $group: { _id: '$branch', total: totalSumGroup(), count: { $sum: 1 } } },
        { $sort: { total: -1 } }
    ]);

    const vatSummary = await Expense.aggregate([
        { $match: expenseFilter },
        {
            $group: {
                _id: null,
                beforeVat: { $sum: { $ifNull: ['$amountBeforeVat', { $ifNull: ['$total', '$amount'] }] } },
                vatAmount: { $sum: { $ifNull: ['$vatAmount', 0] } },
                total: totalSumGroup()
            }
        }
    ]);

    const taxDocumentBreakdown = await Expense.aggregate([
        { $match: expenseFilter },
        {
            $group: {
                _id: { $ifNull: ['$taxDocumentType', 'OTHER'] },
                total: totalSumGroup(),
                count: { $sum: 1 }
            }
        },
        { $sort: { total: -1 } }
    ]);

    return {
        total: totalResult[0]?.total || 0,
        count: totalResult[0]?.count || 0,
        categoryBreakdown,
        branchBreakdown,
        vatSummary: vatSummary[0] || { beforeVat: 0, vatAmount: 0, total: 0 },
        taxDocumentBreakdown
    };
}

function mergeCategoryBreakdown(operatingCats, payrollTotal, payrollCount) {
    const merged = operatingCats.map((c) => ({ ...c }));
    if (payrollTotal > 0) {
        merged.push({
            _id: PAYROLL_CATEGORY,
            total: payrollTotal,
            count: payrollCount
        });
    }
    merged.sort((a, b) => b.total - a.total);
    return merged;
}

async function mergeBranchBreakdown(operatingBranches, payrollBranches, BranchModel) {
    const map = new Map();

    for (const item of operatingBranches) {
        const key = item._id ? item._id.toString() : 'none';
        map.set(key, {
            _id: item._id,
            operatingTotal: item.total,
            payrollTotal: 0,
            count: item.count
        });
    }

    for (const item of payrollBranches) {
        const key = item._id ? item._id.toString() : 'none';
        const prev = map.get(key) || {
            _id: item._id,
            operatingTotal: 0,
            payrollTotal: 0,
            count: 0
        };
        prev.payrollTotal = item.total;
        prev.count += item.count;
        map.set(key, prev);
    }

    const rows = [];
    for (const row of map.values()) {
        const br = row._id ? await BranchModel.findById(row._id).select('name').lean() : null;
        rows.push({
            _id: row._id,
            branchName: br ? br.name : 'Không xác định',
            operatingTotal: row.operatingTotal,
            payrollTotal: row.payrollTotal,
            total: row.operatingTotal + row.payrollTotal,
            count: row.count
        });
    }

    rows.sort((a, b) => b.total - a.total);
    return rows;
}

/**
 * Tổng hợp chi phí: vận hành (Expense) + nhân sự đã trả (Payroll Paid).
 */
async function getCombinedExpenseSummary(options = {}) {
    const Branch = require('../../crm/models/branchModel');
    const expenseFilter = buildOperatingExpenseFilter(options);
    const operating = await aggregateOperatingExpenses(expenseFilter);
    const payroll = await aggregatePaidPayroll(options);

    const categoryBreakdown = mergeCategoryBreakdown(
        operating.categoryBreakdown,
        payroll.total,
        payroll.count
    );

    const branchBreakdown = await mergeBranchBreakdown(
        operating.branchBreakdown,
        payroll.byBranch,
        Branch
    );

    const totalOperating = operating.total;
    const totalPayrollPaid = payroll.total;
    const totalExpenses = totalOperating + totalPayrollPaid;
    const totalCount = operating.count + payroll.count;

    return {
        totalOperating,
        totalPayrollPaid,
        totalExpenses,
        totalCount,
        categoryBreakdown,
        branchBreakdown,
        vatSummary: operating.vatSummary,
        taxDocumentBreakdown: operating.taxDocumentBreakdown,
        operatingBranchRaw: operating.branchBreakdown
    };
}

/**
 * Chi phí theo chi nhánh (cho dashboard KPI) — cùng bộ lọc ngày.
 */
async function getBranchExpenseTotals(branchIds, { startDate, endDate } = {}) {
    const Branch = require('../../crm/models/branchModel');
    const result = {};

    for (const branchId of branchIds) {
        const id = branchId.toString();
        const summary = await getCombinedExpenseSummary({
            startDate,
            endDate,
            branchId: id
        });
        result[id] = {
            operating: summary.totalOperating,
            payrollPaid: summary.totalPayrollPaid,
            total: summary.totalExpenses
        };
    }

    return result;
}

module.exports = {
    PAYROLL_CATEGORY,
    buildOperatingExpenseFilter,
    getCombinedExpenseSummary,
    getBranchExpenseTotals,
    aggregatePaidPayroll,
    mergeCategoryBreakdown,
    totalSumGroup
};
