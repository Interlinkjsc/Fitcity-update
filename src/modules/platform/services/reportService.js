const ExcelJS = require('exceljs');
const Contract = require('../../contracts/models/contractModel.js');
const Expense = require('../../finance/models/expenseModel.js');

/**
 * Generate Quarterly Financial Report in Excel
 */
exports.generateQuarterlyReport = async (year, quarter) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Quarter ${quarter} - ${year}`);

    // Define columns
    sheet.columns = [
        { header: 'Hạng mục', key: 'category', width: 25 },
        { header: 'Tháng 1', key: 'm1', width: 15 },
        { header: 'Tháng 2', key: 'm2', width: 15 },
        { header: 'Tháng 3', key: 'm3', width: 15 },
        { header: 'Tổng Quý', key: 'total', width: 20 }
    ];

    // Styling the header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

    const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
    const months = [startMonth, startMonth + 1, startMonth + 2];

    const reportData = {
        revenue: [0, 0, 0],
        expense: [0, 0, 0]
    };

    // Aggregate Revenue
    for (let i = 0; i < 3; i++) {
        const m = months[i];
        const startDate = new Date(year, m, 1);
        const endDate = new Date(year, m + 1, 0, 23, 59, 59);

        const revenue = await Contract.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate }, paymentStatus: 'Paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        reportData.revenue[i] = revenue[0] ? revenue[0].total : 0;

        const expenses = await Expense.aggregate([
            { $match: { date: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        reportData.expense[i] = expenses[0] ? expenses[0].total : 0;
    }

    // Add Rows
    sheet.addRow({
        category: 'Doanh thu (Revenue)',
        m1: reportData.revenue[0],
        m2: reportData.revenue[1],
        m3: reportData.revenue[2],
        total: reportData.revenue.reduce((a, b) => a + b, 0)
    });

    sheet.addRow({
        category: 'Chi phí (Expenses)',
        m1: reportData.expense[0],
        m2: reportData.expense[1],
        m3: reportData.expense[2],
        total: reportData.expense.reduce((a, b) => a + b, 0)
    });

    sheet.addRow({
        category: 'Lợi nhuận ròng (Net Profit)',
        m1: reportData.revenue[0] - reportData.expense[0],
        m2: reportData.revenue[1] - reportData.expense[1],
        m3: reportData.revenue[2] - reportData.expense[2],
        total: (reportData.revenue.reduce((a, b) => a + b, 0)) - (reportData.expense.reduce((a, b) => a + b, 0))
    });

    // Coloring the Profit row
    const lastRow = sheet.lastRow;
    lastRow.font = { bold: true, color: { argb: 'FF008000' } };

    return workbook;
};
/**
 * Generate Custom Financial Report based on date range and branch
 */
exports.generateCustomReport = async (startDate, endDate, branchId) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo Tài chính Chi tiết');

    sheet.columns = [
        { header: 'Ngày tạo', key: 'date', width: 20 },
        { header: 'Hạng mục', key: 'type', width: 15 },
        { header: 'Nội dung', key: 'title', width: 30 },
        { header: 'Chi nhánh', key: 'branch', width: 20 },
        { header: 'Số tiền (VNĐ)', key: 'amount', width: 20 }
    ];

    sheet.getRow(1).font = { bold: true };

    let dateFilter = { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
    if (branchId && branchId !== 'all') dateFilter.branch = branchId;

    // Fetch Contracts
    const contracts = await Contract.find(dateFilter).populate('branch');
    contracts.forEach(c => {
        sheet.addRow({
            date: c.createdAt.toLocaleString('vi-VN'),
            type: 'Doanh thu',
            title: `HĐ: ${c.contractId || 'N/A'}`,
            branch: c.branch ? c.branch.name : 'N/A',
            amount: c.totalAmount
        });
    });

    // Fetch Expenses (Change filter to date for expense model)
    let expenseFilter = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
    if (branchId && branchId !== 'all') expenseFilter.branch = branchId;
    const expenses = await Expense.find(expenseFilter).populate('branch');
    expenses.forEach(e => {
        sheet.addRow({
            date: e.date.toLocaleString('vi-VN'),
            type: 'Chi phí',
            title: e.description,
            branch: e.branch ? e.branch.name : 'N/A',
            amount: e.amount
        });
    });

    return workbook;
};
