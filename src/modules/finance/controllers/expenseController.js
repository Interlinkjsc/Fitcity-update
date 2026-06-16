const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const Expense = require('../models/expenseModel.js');
const Payroll = require('../models/payrollModel.js');
const Branch = require('../../crm/models/branchModel.js');
const { getPagination } = require('../../../utils/paginationHelper');
const expenseAggregate = require('../services/expenseAggregateService');
const driveService = require('../../platform/services/driveService');
const systemSettingsService = require('../../platform/services/systemSettingsService');
const {
    calculateExpenseVat,
    isCategoryVatExempt,
    EXPENSE_CATEGORY_CONFIG,
    TAX_DOCUMENT_LABELS
} = require('../../../utils/expenseVatHelper');

async function buildExpenseFields(body) {
    const category = body.category;
    if (!category) throw new Error('Loại chi phí là bắt buộc');

    const settings = await systemSettingsService.getGlobalSettings();
    const defaultRate = Number(settings?.defaultVat);
    const vatExempt = isCategoryVatExempt(category);
    const catCfg = EXPENSE_CATEGORY_CONFIG[category] || {};

    let taxDocumentType = body.taxDocumentType || catCfg.defaultTaxDoc || 'INPUT_VAT';
    const allowed = ['OUTPUT_VAT', 'INPUT_VAT', 'PIT', 'SOCIAL_INSURANCE', 'OTHER'];
    if (!allowed.includes(taxDocumentType)) taxDocumentType = 'OTHER';

    const vat = calculateExpenseVat({
        amountBeforeVat: body.amountBeforeVat ?? body.amount,
        vatRate: body.vatRate ?? (Number.isFinite(defaultRate) ? defaultRate : 10),
        vatExempt
    });

    if (!vat.amountBeforeVat) {
        throw new Error('Số tiền trước VAT phải lớn hơn 0');
    }

    return {
        category,
        ...vat,
        taxDocumentType,
        description: body.description,
        date: body.date ? new Date(body.date) : new Date(),
        invoiceImage: body.invoiceImageUrl || body.invoiceImage || undefined
    };
}

async function syncExpenseDriveUpload(expense, uploadMeta) {
    if (!uploadMeta?.path) return;
    const folderId =
        process.env.GOOGLE_DRIVE_EXPENSES_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
    const driveId = await driveService.uploadToDrive(
        uploadMeta.path,
        uploadMeta.fileName,
        folderId
    );
    if (driveId) {
        await driveService.attachDriveIdToExpense(expense._id, driveId);
        const viewUrl = driveService.getDriveViewUrl(driveId);
        if (viewUrl) expense.invoiceImage = viewUrl;
    } else if (uploadMeta.publicUrl) {
        expense.invoiceImage = uploadMeta.publicUrl;
    }
    await expense.save();
    try {
        if (fs.existsSync(uploadMeta.path)) fs.unlinkSync(uploadMeta.path);
    } catch (_) {
        /* ignore */
    }
}

exports.getAllExpenses = async (req, res, next) => {
    try {
        const { startDate, endDate, branchId, category } = req.query;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 7;
        const skip = (page - 1) * limit;

        const managerBranchId =
            req.session.user.role === 'Manager' ? req.session.user.branch : null;

        const summaryOptions = {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            branchId: branchId || 'all',
            managerBranchId
        };

        const combined = await expenseAggregate.getCombinedExpenseSummary(summaryOptions);

        let expenses = [];
        let payrollPaidRows = [];
        let totalDocs = 0;

        if (category === expenseAggregate.PAYROLL_CATEGORY) {
            const payrollMatch = { status: 'Paid' };
            if (startDate || endDate) {
                payrollMatch.paymentDate = {};
                if (startDate) payrollMatch.paymentDate.$gte = new Date(startDate);
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    payrollMatch.paymentDate.$lte = end;
                }
            }

            const payrollList = await Payroll.find(payrollMatch)
                .populate({
                    path: 'staff',
                    select: 'name role branch',
                    populate: { path: 'branch', select: 'name' }
                })
                .sort({ paymentDate: -1 });

            payrollPaidRows = payrollList.filter((p) => {
                if (!managerBranchId && (!branchId || branchId === 'all')) return true;
                const br =
                    p.staff?.branch?._id?.toString() || p.staff?.branch?.toString();
                const want = managerBranchId?.toString() || branchId;
                return br === want;
            });

            totalDocs = payrollPaidRows.length;
            payrollPaidRows = payrollPaidRows.slice(skip, skip + limit);
        } else {
            const filter = expenseAggregate.buildOperatingExpenseFilter(summaryOptions);
            if (category && category !== 'all') {
                filter.category = category;
            }

            totalDocs = await Expense.countDocuments(filter);
            expenses = await Expense.find(filter)
                .populate('branch', 'name')
                .populate('recordedBy', 'name')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit);
        }

        const pagination = getPagination(totalDocs, page, limit);
        const branches = await Branch.find({ status: 'Open' });

        let categoryBreakdown = combined.categoryBreakdown;
        if (category && category !== 'all' && category !== expenseAggregate.PAYROLL_CATEGORY) {
            categoryBreakdown = categoryBreakdown.filter((c) => c._id === category);
        }

        const settings = await systemSettingsService.getGlobalSettings();

        res.render('admin/expenses/list', {
            expenses,
            payrollPaidRows,
            showPayrollOnly: category === expenseAggregate.PAYROLL_CATEGORY,
            branches,
            pagination,
            totalExpenses: combined.totalExpenses,
            totalOperating: combined.totalOperating,
            totalPayrollPaid: combined.totalPayrollPaid,
            totalCount: combined.totalCount,
            categoryBreakdown,
            branchBreakdown: combined.branchBreakdown,
            vatSummary: combined.vatSummary,
            taxDocumentBreakdown: combined.taxDocumentBreakdown,
            defaultVat: settings.defaultVat ?? 10,
            taxDocumentLabels: TAX_DOCUMENT_LABELS,
            currentFilter: {
                startDate: startDate || '',
                endDate: endDate || '',
                branchId: branchId || 'all',
                category: category || 'all'
            },
            activePage: 'expenses',
            query: req.query
        });
    } catch (err) {
        next(err);
    }
};

exports.saveExpense = async (req, res, next) => {
    try {
        const branchId = req.body.branchId || req.session.user.branch;
        if (!branchId) {
            req.flash('error_msg', 'Vui lòng chọn chi nhánh cho khoản chi này.');
            return res.redirect('/admin/expenses');
        }

        const fields = await buildExpenseFields(req.body);

        const expense = await Expense.create({
            branch: branchId,
            recordedBy: req.session.user.id,
            ...fields
        });

        if (req.expenseUpload) {
            await syncExpenseDriveUpload(expense, req.expenseUpload);
        }

        req.flash('success_msg', 'Đã ghi nhận khoản chi phí mới thành công.');
        res.redirect('/admin/expenses');
    } catch (err) {
        if (req.expenseUpload?.path && fs.existsSync(req.expenseUpload.path)) {
            try {
                fs.unlinkSync(req.expenseUpload.path);
            } catch (_) {
                /* ignore */
            }
        }
        const friendlyMessage = err.name === 'ValidationError'
            ? 'Dữ liệu khoản chi không hợp lệ. Vui lòng kiểm tra chi nhánh, loại chi phí và số tiền.'
            : err.message;
        req.flash('error_msg', friendlyMessage);
        res.redirect('/admin/expenses');
    }
};

exports.deleteExpense = async (req, res, next) => {
    try {
        await Expense.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Đã xóa khoản chi phí thành công.');
        res.redirect('/admin/expenses');
    } catch (err) {
        next(err);
    }
};

exports.getDetail = async (req, res, next) => {
    try {
        const expense = await Expense.findById(req.params.id)
            .populate('branch', 'name address phone')
            .populate('recordedBy', 'name email role');

        if (!expense) {
            req.flash('error_msg', 'Không tìm thấy khoản chi này!');
            return res.redirect('/admin/expenses');
        }

        const driveUrl = expense.googleDriveFileId
            ? driveService.getDriveViewUrl(expense.googleDriveFileId)
            : null;

        res.render('admin/expenses/detail', {
            expense,
            driveUrl,
            taxDocumentLabels: TAX_DOCUMENT_LABELS,
            activePage: 'expenses'
        });
    } catch (err) {
        next(err);
    }
};

exports.exportExpensesExcel = async (req, res, next) => {
    try {
        const { startDate, endDate, branchId, quarter, year } = req.query;
        const now = new Date();
        let rangeStart = startDate ? new Date(startDate) : null;
        let rangeEnd = endDate ? new Date(endDate) : null;

        if (quarter && year) {
            const q = parseInt(quarter, 10);
            const y = parseInt(year, 10);
            const startMonth = (q - 1) * 3;
            rangeStart = new Date(y, startMonth, 1);
            rangeEnd = new Date(y, startMonth + 3, 0, 23, 59, 59, 999);
        }

        const managerBranchId =
            req.session.user.role === 'Manager' ? req.session.user.branch : null;

        const filter = expenseAggregate.buildOperatingExpenseFilter({
            startDate: rangeStart,
            endDate: rangeEnd,
            branchId: branchId || 'all',
            managerBranchId
        });

        const expenses = await Expense.find(filter)
            .populate('branch', 'name')
            .populate('recordedBy', 'name')
            .sort({ date: -1 });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'FitCity FMS';
        const sheet = workbook.addWorksheet('Chi phí');

        sheet.columns = [
            { header: 'Ngày', key: 'date', width: 14 },
            { header: 'Chi nhánh', key: 'branch', width: 22 },
            { header: 'Loại', key: 'category', width: 14 },
            { header: 'Trước VAT', key: 'beforeVat', width: 14 },
            { header: '% VAT', key: 'vatRate', width: 8 },
            { header: 'Tiền VAT', key: 'vatAmount', width: 14 },
            { header: 'Tổng', key: 'total', width: 14 },
            { header: 'Chứng từ thuế', key: 'taxDoc', width: 18 },
            { header: 'Mô tả', key: 'description', width: 28 },
            { header: 'Người ghi', key: 'recordedBy', width: 18 }
        ];

        sheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '1E293B' }
            };
        });

        expenses.forEach((exp) => {
            const total = exp.total ?? exp.amount ?? 0;
            sheet.addRow({
                date: new Date(exp.date).toLocaleDateString('vi-VN'),
                branch: exp.branch?.name || '',
                category: exp.category,
                beforeVat: exp.amountBeforeVat ?? total,
                vatRate: exp.vatRate ?? 0,
                vatAmount: exp.vatAmount ?? 0,
                total,
                taxDoc: TAX_DOCUMENT_LABELS[exp.taxDocumentType] || exp.taxDocumentType,
                description: exp.description || '',
                recordedBy: exp.recordedBy?.name || ''
            });
        });

        const suffix =
            quarter && year
                ? `Q${quarter}_${year}`
                : new Date().toISOString().slice(0, 10);
        const fileName = `Expenses_${suffix}.xlsx`;

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};
