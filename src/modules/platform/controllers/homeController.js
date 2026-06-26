const mongoose = require('mongoose');
const Contract = require('../../contracts/models/contractModel.js');
const WorkoutSession = require('../../programs/models/workoutSessionModel.js');
const User = require('../../users/models/userModel.js');
const Payroll = require('../../finance/models/payrollModel.js');
const Expense = require('../../finance/models/expenseModel.js');
const MealPlan = require('../../programs/models/mealPlanModel.js');
const KPIConfig = require('../../programs/models/kpiModel.js');
const Branch = require('../../crm/models/branchModel.js');
const path = require('path');
const fs = require('fs');
const reportService = require('../services/reportService');
const Violation = require('../../crm/models/violationModel.js');
const contractScope = require('../../contracts/services/contractScopeService');
const kpiService = require('../services/kpiService');
const expenseAggregate = require('../../finance/services/expenseAggregateService');
const payrollService = require('../../finance/services/payrollService');
const qualityService = require('../services/qualityService');
const dailyReportService = require('../services/dailyReportService');

function mergeContractScope(baseMatch, user, queryBranchId) {
    const scope = contractScope.buildContractListFilter(user, {
        branchId: queryBranchId && queryBranchId !== 'all' ? queryBranchId : undefined
    });
    if (!scope || Object.keys(scope).length === 0) return baseMatch;
    return { $and: [baseMatch, scope] };
}

exports.getAdminDashboard = async (req, res, next) => {
    try {
        let { startDate, endDate, branchId, filterType, filterValue } = req.query;
        const user = req.session.user;

        if (user.role === 'Manager' && user.branch && (!branchId || branchId === 'all')) {
            branchId = user.branch.toString();
        }

        // Xử lý filter mới dựa trên filterType và filterValue
        if (filterType && filterValue && filterType !== 'range') {
            if (filterType === 'date') {
                startDate = filterValue;
                endDate = filterValue;
            } else if (filterType === 'month') {
                const [y, m] = filterValue.split('-');
                startDate = `${y}-${m}-01`;
                const lastDay = new Date(y, m, 0).getDate();
                endDate = `${y}-${m}-${lastDay}`;
            } else if (filterType === 'year') {
                startDate = `${filterValue}-01-01`;
                endDate = `${filterValue}-12-31`;
            }
        }
        
        // 1. Build Date Filter
        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.createdAt.$lte = end;
            }
        } else {
            // Default to this month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0,0,0,0);
            dateFilter.createdAt = { $gte: startOfMonth };
        }

        if (branchId && branchId !== 'all') {
            dateFilter.branch = branchId;
        }

        const contractBaseMatch = mergeContractScope(
            { ...dateFilter, contractStatus: { $ne: 'Cancelled' } },
            user,
            branchId
        );

        const revenueStats = await Contract.aggregate([
            { $match: contractBaseMatch },
            { $group: contractScope.revenueAggregateGroup() }
        ]);

        const totalRevenueAfterTax = revenueStats[0] ? revenueStats[0].totalAfterTax : 0;
        const totalRevenueBeforeTax = revenueStats[0] ? revenueStats[0].totalNet : 0;

        
        // 3. Expenses (vận hành + lương đã thanh toán) — dùng field `date` / `paymentDate`, không dùng createdAt HĐ
        const expenseStart = startDate || (dateFilter.createdAt?.$gte
            ? dateFilter.createdAt.$gte.toISOString().slice(0, 10)
            : undefined);
        const expenseEnd = endDate || (dateFilter.createdAt?.$lte
            ? dateFilter.createdAt.$lte.toISOString().slice(0, 10)
            : undefined);

        const expenseSummary = await expenseAggregate.getCombinedExpenseSummary({
            startDate: expenseStart,
            endDate: expenseEnd,
            branchId: branchId || 'all',
            managerBranchId: user.role === 'Manager' ? user.branch : null
        });

        const totalOperatingExpenses = expenseSummary.totalOperating;
        const totalPayrollPaid = expenseSummary.totalPayrollPaid;
        const totalExpenses = expenseSummary.totalExpenses;

        // 4. Profit
        const netProfit = totalRevenueAfterTax - totalExpenses;

        
        // 5. Pending Receivables - Loại bỏ hợp đồng Cancelled
        const pendingResult = await Contract.aggregate([
            { $match: contractBaseMatch },
            { $project: { pending: { $subtract: ['$totalAmount', '$paidAmount'] } } },
            { $group: { _id: null, totalPending: { $sum: '$pending' } } }
        ]);
        const pendingReceivables = pendingResult[0] ? pendingResult[0].totalPending : 0;

        // 6. Active Members & Online Status
        const activeMembers = await User.countDocuments({ role: 'Client', status: 'Active' });

        // Đếm hội viên (Client) đang đăng nhập — unique userId, không đếm raw session (1 user nhiều tab = nhiều session)
        let onlineMembers = 0;
        try {
            const sessionsCollection = User.db.collection('sessions');
            if (sessionsCollection) {
                const now = new Date();
                const sessionDocs = await sessionsCollection
                    .find({ expires: { $gt: now } })
                    .project({ session: 1 })
                    .toArray();
                const onlineClientIds = new Set();
                for (const doc of sessionDocs) {
                    if (!doc.session) continue;
                    try {
                        const data = JSON.parse(doc.session);
                        const u = data?.user;
                        if (u?.id && u.role === 'Client') {
                            onlineClientIds.add(String(u.id));
                        }
                    } catch (_) { /* skip malformed session payload */ }
                }
                onlineMembers = onlineClientIds.size;
            }
        } catch (e) {
            console.error('Error fetching online sessions:', e);
            onlineMembers = 0;
        }

        // Lấy danh sách client_id ĐỘC NHẤT (distinct) đang có hợp đồng Active
        const distinctActiveContractClients = await Contract.distinct('client', { contractStatus: 'Active' });
        const membersWithActiveContract = distinctActiveContractClients.length;

        // 7. Sessions Today - Loại bỏ buổi tập Cancelled
        const todayAtZero = new Date();
        todayAtZero.setHours(0,0,0,0);
        const tomorrow = new Date(todayAtZero);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const sessionsToday = await WorkoutSession.countDocuments({
            scheduledTime: { $gte: todayAtZero, $lt: tomorrow },
            status: { $ne: 'Cancelled' }
        });

        
        // 8. KPI Performance by Branch - Đồng bộ Target theo bộ lọc
        const kpiDate = startDate ? new Date(startDate) : new Date();
        const currentMonth = kpiDate.getMonth() + 1;
        const currentYear = kpiDate.getFullYear();
        
        let branchKpis = await Branch.find();
        if (user.role === 'Manager' && user.branch) {
            branchKpis = branchKpis.filter((b) => b._id.toString() === user.branch.toString());
        }
        const branchExpenseMap = await expenseAggregate.getBranchExpenseTotals(
            branchKpis.map((b) => b._id),
            { startDate: expenseStart, endDate: expenseEnd }
        );

        const kpiReport = await Promise.all(branchKpis.map(async (branch) => {
            const branchKPI = await kpiService.getBranchKPI(branch, currentMonth, currentYear);
            const exp = branchExpenseMap[branch._id.toString()] || { operating: 0, payrollPaid: 0, total: 0 };
            return {
                name: branch.name,
                target: branchKPI.revenueTarget,
                actual: branchKPI.revenueActual,
                percent: branchKPI.revenuePercent.toFixed(1),
                contractTarget: branchKPI.contractTarget,
                contractActual: branchKPI.contractActual,
                contractPercent: branchKPI.contractPercent,
                newLeadTarget: branchKPI.newLeadTarget,
                newLeadActual: branchKPI.newLeadActual,
                leadPercent: branchKPI.leadPercent,
                expenseOperating: exp.operating,
                expensePayroll: exp.payrollPaid,
                expenseTotal: exp.total
            };
        }));

        
        // 9. Staff Performance (PT sessions, working days, Sales Revenue with Targets)
        const ptPerformance = await WorkoutSession.aggregate([
            { $match: { scheduledTime: dateFilter.createdAt, status: 'Completed' } },
            { $group: { 
                _id: '$pt', 
                sessionCount: { $sum: 1 },
                workingDays: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledTime' } } }
            } },
            { $addFields: { workingDayCount: { $size: '$workingDays' } } },
            { $sort: { sessionCount: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'ptInfo' } },
            { $unwind: '$ptInfo' }
        ]);

        // Phase 3: Enhanced sales performance with target comparison
        const salesPerformance = await Contract.aggregate([
            { $match: contractBaseMatch },
            { $group: { _id: '$sales', revenue: { $sum: contractScope.NET_AMOUNT_EXPR }, contractCount: { $sum: 1 } } },
            { $sort: { revenue: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'salesInfo' } },
            { $unwind: '$salesInfo' }
        ]);

        // Phase 3: Add sales-level KPI targets from KPIConfig per branch
        const salesPerformanceWithTargets = await Promise.all(salesPerformance.map(async (s) => {
            const branchIdFromUser = s.salesInfo.branch;
            let targetConfig = null;
            if (branchIdFromUser) {
                targetConfig = await KPIConfig.findOne({ branch: branchIdFromUser, month: currentMonth, year: currentYear });
            }
            return {
                ...s,
                contractTarget: targetConfig?.contractTarget || 0,
                newLeadTarget: targetConfig?.newLeadTarget || 0,
                revenueTarget: targetConfig?.revenueTarget || 0,
                leadCount: 0 // Populated below
            };
        }));

        // Phase 3: Also lookup lead counts for each sales person this month
        const leadStartDate = new Date(currentYear, currentMonth - 1, 1);
        const leadEndDate = new Date(currentYear, currentMonth, 1);
        const leadCounts = await require('../../crm/models/leadModel').aggregate([
            { $match: { createdAt: { $gte: leadStartDate, $lt: leadEndDate }, source: { $ne: null } } },
            { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
        ]);
        const leadCountMap = {};
        leadCounts.forEach(lc => { if (lc._id) leadCountMap[lc._id.toString()] = lc.count; });
        salesPerformanceWithTargets.forEach(s => {
            s.leadCount = leadCountMap[s._id.toString()] || 0;
        });

        // 10. Recent pending contracts
        const pendingContracts = await Contract.find({ paymentStatus: { $ne: 'Paid' } })
            .populate('client', 'name avatar')
            .populate('pt', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        const branches = await Branch.find();

        const csatStart = startDate ? new Date(startDate) : (dateFilter.createdAt?.$gte || new Date(new Date().getFullYear(), new Date().getMonth(), 1));
        const csatEnd = endDate ? new Date(endDate) : (dateFilter.createdAt?.$lte || new Date());
        if (endDate) {
            csatEnd.setHours(23, 59, 59, 999);
        }
        const csatSummary = await qualityService.getCsatSummary({
            startDate: csatStart,
            endDate: csatEnd,
            branchId: branchId || 'all'
        });

        const drMonth = startDate
            ? new Date(startDate).getMonth() + 1
            : new Date().getMonth() + 1;
        const drYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
        const dailyReportStats = await dailyReportService.getCompletionStats({
            branchId: branchId || 'all',
            month: drMonth,
            year: drYear,
            managerBranchId: user.role === 'Manager' ? user.branch : null
        });

        res.render('admin/dashboard', {
            totalRevenueAfterTax,
            totalRevenueBeforeTax,
            totalExpenses,
            totalOperatingExpenses,
            totalPayrollPaid,
            netProfit,
            pendingReceivables,
            activeMembers,
            onlineMembers,
            membersWithActiveContract,
            sessionsToday,
            pendingContracts,
            ptPerformance,
            salesPerformance: salesPerformanceWithTargets,
            kpiReport,
            branches,
            csatSummary,
            dailyReportStats,
            workReportMonth: drMonth,
            workReportYear: drYear,
            currentFilter: { startDate, endDate, branchId: branchId || 'all', filterType, filterValue },
            activePage: 'dashboard'
        });
    } catch (error) {
        next(error);
    }
};

exports.getPtDashboard = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;
        
        const today = new Date();
        today.setHours(0,0,0,0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const roster = await WorkoutSession.find({
            pt: ptId,
            scheduledTime: { $gte: today, $lt: tomorrow },
            status: { $in: ['Pending_Admin', 'Scheduled', 'In_Progress'] }
        }).populate('client', 'name avatar');

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0,0,0,0);
        
        const ptUser = await User.findById(ptId);
        const baseSalary = ptUser ? ptUser.baseSalary || 5000000 : 5000000;

        const completedSessions = await WorkoutSession.countDocuments({
            pt: ptId,
            status: 'Completed',
            scheduledTime: { $gte: startOfMonth }
        });

        const paidContractsThisMonth = await Contract.find({
            pt: ptId,
            paymentStatus: 'Paid',
            createdAt: { $gte: startOfMonth }
        }).select('ptCommission');

        // Phase 3: Use netAmount for KPI consistency
        const revenueResult = await Contract.aggregate([
            { $match: { 
                pt: new mongoose.Types.ObjectId(ptId), 
                createdAt: { $gte: startOfMonth },
                contractStatus: { $ne: 'Cancelled' } 
            } },
            { $group: { _id: null, totalRevenue: { $sum: contractScope.NET_AMOUNT_EXPR } } }
        ]);
        const newContractRevenue = revenueResult[0] ? revenueResult[0].totalRevenue : 0;
        
        // Lấy mục tiêu KPI của chi nhánh (để PT so sánh hoặc làm mốc)
        const branchKpi = await KPIConfig.findOne({ 
            branch: ptUser.branch, 
            month: today.getMonth() + 1, 
            year: today.getFullYear() 
        });
        const revenueTarget = branchKpi ? branchKpi.revenueTarget : 100000000; // Mặc định 100tr nếu chưa set target

        // Tính các khoản phạt (Violations) trong tháng
        const violations = await Violation.find({ 
            staff: ptId, 
            date: { $gte: startOfMonth },
            status: { $ne: 'Cancelled' }
        });
        const totalDeductions = violations.reduce((sum, v) => sum + v.penaltyAmount, 0);

        const estimatedCommission = payrollService.calculatePTCommissionFromContracts(paidContractsThisMonth);
        const totalEstimatedIncome = baseSalary + estimatedCommission - totalDeductions;

        const recentFeedbacks = await WorkoutSession.find({
            pt: ptId,
            'feedback.rating': { $exists: true, $ne: null }
        })
        .populate('client', 'name')
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean();

        res.render('pt/dashboard', {
            estimatedCommission,
            totalEstimatedIncome,
            baseSalary,
            totalDeductions,
            revenueTarget,
            newContractRevenue,
            completedSessions,
            rosterCount: roster.length,
            roster,
            recentFeedbacks,
            violations: violations.slice(0, 3)
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PT: Danh sách khách hàng được phân phối
 */
exports.getPtClients = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;

        const contracts = await Contract.find({ pt: ptId, contractStatus: 'Active' })
            .populate('client', 'name email phone avatar')
            .populate('servicePackage', 'name type sessionType duration sessions')
            .sort({ createdAt: -1 });

        res.render('pt/clients', {
            contracts,
            activePage: 'dashboard'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PT: Lịch dạy theo tuần
 */
exports.getPtSchedule = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;

        // Support ?week=YYYY-MM-DD for prev/next navigation
        let baseDate;
        if (req.query.week) {
            baseDate = new Date(req.query.week);
            if (isNaN(baseDate.getTime())) baseDate = new Date();
        } else {
            baseDate = new Date();
        }

        const dayOfWeek = baseDate.getDay() || 7; // Sun=0 → 7
        const monday = new Date(baseDate);
        monday.setDate(baseDate.getDate() - dayOfWeek + 1);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const sessions = await WorkoutSession.find({
            pt: ptId,
            scheduledTime: { $gte: monday, $lte: sunday }
        }).populate('client', 'name avatar').sort({ scheduledTime: 1 });

        // Group by day of week
        const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        const schedule = {};
        weekDays.forEach((day, idx) => {
            const dayDate = new Date(monday);
            dayDate.setDate(monday.getDate() + idx);
            schedule[day] = {
                date: dayDate,
                sessions: sessions.filter(s => {
                    const d = new Date(s.scheduledTime);
                    return d.getDate() === dayDate.getDate() && d.getMonth() === dayDate.getMonth();
                })
            };
        });

        // Lấy danh sách hợp đồng active để PT lên lịch trực tiếp
        const activeContracts = await Contract.find({ pt: ptId, contractStatus: 'Active' })
            .populate('client', 'name avatar')
            .select('_id client remainingSessions')
            .sort({ createdAt: -1 })
            .lean();

        res.render('pt/schedule', {
            schedule,
            weekDays,
            monday,
            sunday,
            activeContracts,
            activePage: 'dashboard'
        });
    } catch (error) {
        next(error);
    }
};

exports.getClientDashboard = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        
        const contract = await Contract.findOne({ client: clientId, contractStatus: 'Active' })
            .populate('servicePackage')
            .populate('pt', 'name avatar')
            .sort({ createdAt: -1 });

        const sessionsCompleted = await WorkoutSession.countDocuments({
            client: clientId,
            status: 'Completed'
        });

        const pendingConfirmation = await WorkoutSession.findOne({
            client: clientId,
            status: 'Completed',
            'clientConfirmation.isConfirmed': false
        }).populate('pt', 'name avatar');

        const pendingFeedback = await WorkoutSession.findOne({
            client: clientId,
            status: { $in: ['Completed', 'Confirmed'] },
            'clientConfirmation.isConfirmed': true,
            $or: [
                { 'feedback.rating': { $exists: false } },
                { 'feedback.rating': null }
            ]
        })
            .populate('pt', 'name avatar')
            .sort({ endTime: -1 });

        const mealPlan = await MealPlan.findOne({ client: clientId, active: true }).sort({ createdAt: -1 });

        const inProgressSession = await WorkoutSession.findOne({
            client: clientId,
            status: 'In_Progress'
        })
            .populate('pt', 'name avatar')
            .sort({ scheduledTime: 1 })
            .lean();

        const nextScheduledSession = await WorkoutSession.findOne({
            client: clientId,
            status: 'Scheduled',
            scheduledTime: { $gte: new Date() }
        })
            .populate('pt', 'name avatar')
            .sort({ scheduledTime: 1 })
            .lean();

        const nextSession = inProgressSession || nextScheduledSession;

        let qrSession = null;
        if (inProgressSession) {
            qrSession = inProgressSession;
        } else if (nextScheduledSession) {
            qrSession = nextScheduledSession;
        } else {
            const fallback = await WorkoutSession.findOne({
                client: clientId,
                status: 'Scheduled'
            })
                .populate('pt', 'name avatar')
                .sort({ scheduledTime: 1 })
                .lean();
            qrSession = fallback;
        }

        const Reward = require('../../programs/models/rewardModel.js');
        const activeRewardsCount = await Reward.countDocuments({
            client: clientId,
            status: 'Active',
            expiresAt: { $gte: new Date() }
        });
        
        const { computeMealNutrition } = require('../../../utils/mealNutritionHelper');
        const mealNutritionByMeal = mealPlan ? computeMealNutrition(mealPlan) : [];

        const remainingSessions = contract ? (contract.remainingSessions ?? (contract.totalSessions - sessionsCompleted)) : 0;

        res.render('client/dashboard', {
            sessionsCompleted,
            totalSessions: contract ? contract.totalSessions : 0,
            remainingSessions: Math.max(0, remainingSessions),
            packageName: contract && contract.servicePackage ? contract.servicePackage.name : "Chưa có gói tập",
            contract,
            pendingConfirmation,
            pendingFeedback,
            mealPlan,
            mealNutritionByMeal,
            nextSession,
            qrSession,
            activeRewardsCount
        });
    } catch (error) {
        next(error);
    }
};

exports.getClientNutrition = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        const mealPlan = await MealPlan.findOne({ client: clientId, active: true })
            .populate('pt', 'name avatar')
            .sort({ createdAt: -1 });

        const { computeMealNutrition } = require('../../../utils/mealNutritionHelper');
        const mealNutritionByMeal = mealPlan ? computeMealNutrition(mealPlan) : [];

        const mealLogService = require('../../programs/services/mealLogService');
        const todayLogs = await mealLogService.getLogsForDate(clientId);
        const recentLogs = await mealLogService.getRecentLogs(clientId, 7);
        const todayStr = new Date().toISOString().slice(0, 10);

        res.render('client/nutrition', {
            mealPlan,
            mealNutritionByMeal,
            todayLogs,
            recentLogs,
            todayStr
        });
    } catch (error) {
        next(error);
    }
};

exports.exportReport = async (req, res, next) => {
    try {
        const { year = new Date().getFullYear(), quarter, startDate, endDate, branchId, filterType, filterValue } = req.query;
        let workbook;
        let fileName;

        if (startDate && endDate) {
            workbook = await reportService.generateCustomReport(startDate, endDate, branchId);
            if (filterType && filterValue && filterType !== 'range') {
                fileName = `FitCity_Report_${filterType.toUpperCase()}_${filterValue}.xlsx`;
            } else {
                fileName = `FitCity_Report_Custom_${startDate}_to_${endDate}.xlsx`;
            }
        } else {
            const q = quarter || Math.ceil((new Date().getMonth() + 1) / 3);
            workbook = await reportService.generateQuarterlyReport(Number(year), Number(q));
            fileName = `Financial_Report_Q${q}_${year}.xlsx`;
        }

        const tempPath = path.join(__dirname, '../../../tmp', fileName);
        if (!fs.existsSync(path.join(__dirname, '../../../tmp'))) fs.mkdirSync(path.join(__dirname, '../../../tmp'));

        await workbook.xlsx.writeFile(tempPath);

        res.download(tempPath, fileName, (err) => {
            if (err) next(err);
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch(e) {}
        });
    } catch (err) {
        next(err);
    }
};
