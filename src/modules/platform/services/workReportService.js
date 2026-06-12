const ExcelJS = require('exceljs');
const ChecklistTask = require('../models/checklistTaskModel');
const DailyReport = require('../models/dailyReportModel');
const dailyReportService = require('./dailyReportService');

async function fetchWorkReportData({ month, year, branchId, managerBranchId }) {
    const { start, end } = dailyReportService.monthRange(month, year);

    const checklistFilter = { createdAt: { $gte: start, $lte: end } };
    const reportFilter = { reportDate: { $gte: start, $lte: end } };

    if (managerBranchId) {
        checklistFilter.branch = managerBranchId;
        reportFilter.branch = managerBranchId;
    } else if (branchId && branchId !== 'all') {
        checklistFilter.branch = branchId;
        reportFilter.branch = branchId;
    }

    const [checklists, reports] = await Promise.all([
        ChecklistTask.find(checklistFilter)
            .populate('assignee', 'name role')
            .populate('branch', 'name')
            .sort({ dueDate: 1 }),
        DailyReport.find(reportFilter)
            .populate('author', 'name role')
            .populate('branch', 'name')
            .sort({ reportDate: -1 })
    ]);

    return { checklists, reports, start, end };
}

exports.generateWorkReportWorkbook = async (options) => {
    const { checklists, reports } = await fetchWorkReportData(options);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FitCity FMS';

    const sheetChecklist = workbook.addWorksheet('Checklist');
    sheetChecklist.columns = [
        { header: 'Công việc', key: 'title', width: 28 },
        { header: 'Người nhận', key: 'assignee', width: 18 },
        { header: 'Chi nhánh', key: 'branch', width: 16 },
        { header: 'Hạn', key: 'due', width: 12 },
        { header: 'Ưu tiên', key: 'priority', width: 10 },
        { header: 'Trạng thái', key: 'status', width: 12 }
    ];
    checklists.forEach((t) => {
        sheetChecklist.addRow({
            title: t.title,
            assignee: t.assignee?.name || '—',
            branch: t.branch?.name || '—',
            due: t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : '',
            priority: t.priority,
            status: t.status
        });
    });

    const sheetDaily = workbook.addWorksheet('Daily Report');
    sheetDaily.columns = [
        { header: 'Ngày', key: 'date', width: 12 },
        { header: 'Nhân viên', key: 'author', width: 20 },
        { header: 'Vai trò', key: 'role', width: 10 },
        { header: 'Chi nhánh', key: 'branch', width: 16 },
        { header: 'Tóm tắt', key: 'summary', width: 36 },
        { header: 'Trạng thái', key: 'status', width: 14 }
    ];
    reports.forEach((r) => {
        sheetDaily.addRow({
            date: new Date(r.reportDate).toLocaleDateString('vi-VN'),
            author: r.author?.name || '—',
            role: r.author?.role || '',
            branch: r.branch?.name || '—',
            summary: r.summary,
            status: r.status
        });
    });

    return workbook;
};

exports.fetchWorkReportData = fetchWorkReportData;
