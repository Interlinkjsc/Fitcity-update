const workReportService = require('../services/workReportService');

exports.exportWorkReport = async (req, res, next) => {
    try {
        const now = new Date();
        const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
        const year = parseInt(req.query.year, 10) || now.getFullYear();
        const branchId = req.query.branchId || 'all';

        const workbook = await workReportService.generateWorkReportWorkbook({
            month,
            year,
            branchId,
            managerBranchId:
                req.session.user.role === 'Manager' ? req.session.user.branch : null
        });

        const fileName = `Work_Report_${month}_${year}.xlsx`;
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
