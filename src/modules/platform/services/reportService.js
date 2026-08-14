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
    // Rp27/7 A4+A5+A6+A7: mã HĐ thay "Nội dung N/A", thêm công nợ + NV sale,
    // gộp doanh thu phí gia hạn (Extension_Fee), chi phí ghi ÂM, format số #.##0.
    const Transaction = require('../../contracts/models/transactionModel.js');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo Tài chính Chi tiết');

    sheet.columns = [
        { header: 'Ngày tạo', key: 'date', width: 20 },
        { header: 'Hạng mục', key: 'type', width: 18 },
        { header: 'Mã HĐ', key: 'contractCode', width: 26 },
        { header: 'Diễn giải', key: 'note', width: 28 },
        { header: 'Khách hàng', key: 'clientName', width: 22 },
        { header: 'NV Sale', key: 'salesName', width: 20 },
        { header: 'Chi nhánh', key: 'branch', width: 22 },
        { header: 'Giá trị HĐ (VNĐ)', key: 'amount', width: 18 },
        { header: 'Đã thu (VNĐ)', key: 'paid', width: 18 },
        { header: 'Công nợ (VNĐ)', key: 'debt', width: 18 }
    ];
    sheet.getRow(1).font = { bold: true };
    const MONEY_FMT = '#,##0;[Red]-#,##0';
    ['amount', 'paid', 'debt'].forEach(k => { sheet.getColumn(k).numFmt = MONEY_FMT; });

    // QC review 1+2: input 'YYYY-MM-DD' phải hiểu theo GIỜ ĐỊA PHƯƠNG (new Date(string) parse UTC
    // → lệch +7h, mất giao dịch 00:00-06:59 ngày đầu) và ngày cuối phải trọn tới 23:59:59.999.
    const parseLocalDate = (input, endOfDay) => {
        let d;
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input));
        if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        else d = new Date(input);
        if (endOfDay && !Number.isNaN(d.getTime())) d.setHours(23, 59, 59, 999);
        return d;
    };
    const rangeStart = parseLocalDate(startDate, false);
    const rangeEnd = parseLocalDate(endDate, true);

    // QC review 1: mã HĐ legacy rỗng → sinh mã hiển thị theo quy tắc khách: dd.mm.yyyy + tên KH viết tắt
    const displayCode = (c) => {
        if (c.contractCode) return c.contractCode;
        const d = c.createdAt ? new Date(c.createdAt) : null;
        const datePart = d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}` : '';
        const initials = c.client && c.client.name
            ? c.client.name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase()
            : '';
        return datePart ? `${datePart} ${initials}`.trim() : '';
    };

    let dateFilter = { createdAt: { $gte: rangeStart, $lte: rangeEnd } };
    if (branchId && branchId !== 'all') dateFilter.branch = branchId;

    // 1) Doanh thu từ hợp đồng
    const contracts = await Contract.find(dateFilter)
        .populate('branch', 'name')
        .populate('client', 'name')
        .populate('sales', 'name');
    contracts.forEach(c => {
        const total = c.totalAmount || c.netAmount || 0;
        const paid = c.paidAmount || 0;
        sheet.addRow({
            date: c.createdAt.toLocaleString('vi-VN'),
            type: 'Doanh thu',
            contractCode: displayCode(c),
            note: '',
            clientName: c.client ? c.client.name : '',
            salesName: c.sales ? c.sales.name : '',
            branch: c.branch ? c.branch.name : '',
            amount: total,
            paid,
            debt: Math.max(0, total - paid)
        });
    });

    // 2) Doanh thu phí gia hạn HĐ (Extension_Fee) — trước đây bị bỏ sót (A5)
    // QC review 1: lọc chi nhánh TRƯỚC khi hiển thị + tính tổng; loại giao dịch mồ côi
    // (không populate được contract) khi đang lọc theo chi nhánh.
    const extFeesRaw = await Transaction.find({
        transactionType: 'Extension_Fee',
        status: 'Success',
        createdAt: { $gte: rangeStart, $lte: rangeEnd }
    }).populate({
        path: 'contractId',
        select: 'contractCode client sales branch createdAt',
        populate: [
            { path: 'client', select: 'name' },
            { path: 'sales', select: 'name' },
            { path: 'branch', select: 'name' }
        ]
    });
    const filteringBranch = branchId && branchId !== 'all';
    const extFees = extFeesRaw.filter(t => {
        const c = t.contractId;
        // QC review 2: giao dịch mồ côi (không populate được HĐ) bị loại ở MỌI chế độ lọc
        if (!c) return false;
        if (!filteringBranch) return true;
        if (!c.branch) return false;
        return String(c.branch._id) === String(branchId);
    });
    extFees.forEach(t => {
        const c = t.contractId || {};
        sheet.addRow({
            date: t.createdAt.toLocaleString('vi-VN'),
            type: 'Phí gia hạn HĐ (chưa VAT)',
            contractCode: c.contractCode ? c.contractCode : (c.createdAt ? displayCode(c) : ''),
            note: 'Phí gia hạn 200.000đ/tháng — chưa gồm VAT (chờ khách chốt quy tắc VAT)',
            clientName: c.client ? c.client.name : '',
            salesName: c.sales ? c.sales.name : '',
            branch: c.branch ? c.branch.name : '',
            amount: t.amount || 0,
            paid: t.amount || 0,
            debt: 0
        });
    });

    // 3) Chi phí — ghi số ÂM để dễ đọc (A7). QC review 1: mô tả để cột Diễn giải, KHÔNG chiếm cột Mã HĐ.
    let expenseFilter = { date: { $gte: rangeStart, $lte: rangeEnd } };
    if (filteringBranch) expenseFilter.branch = branchId;
    const expenses = await Expense.find(expenseFilter).populate('branch', 'name');
    expenses.forEach(e => {
        sheet.addRow({
            date: e.date.toLocaleString('vi-VN'),
            type: 'Chi phí',
            contractCode: '',
            note: e.description || '',
            clientName: '',
            salesName: '',
            branch: e.branch ? e.branch.name : '',
            amount: -(e.amount || 0),
            paid: -(e.amount || 0),
            debt: 0
        });
    });

    // 4) Dòng tổng — QC review 1: tổng tính trên đúng tập extFees ĐÃ LỌC chi nhánh
    const sumContracts = contracts.reduce((s, c) => s + (c.totalAmount || c.netAmount || 0), 0);
    const sumContractsPaid = contracts.reduce((s, c) => s + (c.paidAmount || 0), 0);
    const sumExt = extFees.reduce((s, t) => s + (t.amount || 0), 0);
    const sumExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const sumRow = sheet.addRow({
        date: 'TỔNG CỘNG',
        amount: sumContracts + sumExt - sumExpense,
        paid: sumContractsPaid + sumExt - sumExpense,
        debt: contracts.reduce((s, c) => s + Math.max(0, (c.totalAmount || c.netAmount || 0) - (c.paidAmount || 0)), 0)
    });
    sumRow.font = { bold: true };

    return workbook;
};
