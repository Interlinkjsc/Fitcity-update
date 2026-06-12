const Lead = require('../models/leadModel.js');
const Branch = require('../models/branchModel.js');
const User = require('../../users/models/userModel.js');
const Contract = require('../../contracts/models/contractModel.js');
const clientManagementService = require('../../clients/services/clientManagementService.js');
const { hash } = require('../../../utils/encryption.js');
const ExcelJS = require('exceljs');
const notificationService = require('../../platform/services/notificationService');
const { sendClientWelcomeEmail } = require('../../platform/services/welcomeEmailService.js');
const cmsService = require('../services/cmsService');
const { getFunnelCounts } = require('../services/leadFunnelService');

const LEAD_SOURCES = ['Website', 'Contact', 'Facebook', 'Referral', 'Walk-in'];

async function notifyLeadCreated(lead, branchId, name, interestedPackage) {
    const notifyUsers = await User.find({
        role: { $in: ['Marketing', 'Manager', 'Admin'] },
        status: 'Active',
        ...(branchId ? { $or: [{ branch: branchId }, { role: { $in: ['Marketing', 'Admin'] } }] } : {})
    }).select('_id');

    await Promise.all(
        notifyUsers.map((u) =>
            notificationService.pushNotification(
                u._id,
                'Lead mới',
                `${name} — ${interestedPackage || 'Gym'}`,
                'Info',
                `/admin/leads/detail/${lead._id}`
            )
        )
    );
}

/**
 * Hiển thị Landing Page với form thu thập Leads
 */
exports.getLandingPage = async (req, res, next) => {
    try {
        const [branches, banners, homeSeo] = await Promise.all([
            Branch.find({ status: 'Open' }),
            cmsService.getPublishedBanners(),
            cmsService.getHomeSeo()
        ]);
        res.render('landing', { branches, banners, homeSeo });
    } catch (err) {
        next(err);
    }
};

exports.getContactPage = async (req, res, next) => {
    try {
        const branches = await Branch.find({ status: 'Open' });
        res.render('contact', { branches });
    } catch (err) {
        next(err);
    }
};

exports.getBlogList = async (req, res, next) => {
    try {
        const posts = await cmsService.getPublishedPosts(24);
        res.render('blog/list', { posts });
    } catch (err) {
        next(err);
    }
};

exports.getBlogPost = async (req, res, next) => {
    try {
        const post = await cmsService.getPostBySlug(req.params.slug);
        if (!post) {
            req.flash('error_msg', 'Bài viết không tồn tại hoặc chưa xuất bản.');
            return res.redirect('/blog');
        }
        res.render('blog/detail', { post });
    } catch (err) {
        next(err);
    }
};

/**
 * Xử lý đăng ký tập thử từ Landing Page (Leads generation)
 */
exports.registerLead = async (req, res, next) => {
    try {
        const {
            name,
            phone,
            email,
            branchId,
            interestedPackage,
            notes,
            weight,
            height,
            bodyFat,
            muscleMass,
            targetGoal,
            source,
            redirectTo
        } = req.body;

        const leadSource = LEAD_SOURCES.includes(source) ? source : 'Website';
        const pkg = ['Gym', 'Yoga', 'PT', 'Kickfit', 'Pilates'].includes(interestedPackage)
            ? interestedPackage
            : 'Gym';

        /** R1 (act-11): không tạo Lead nếu email đã là tài khoản hội viên (Client). */
        const emailTrim = typeof email === 'string' ? email.trim() : '';
        if (emailTrim) {
            const existingClient = await User.findOne({
                emailHash: hash(emailTrim),
                role: 'Client'
            })
                .select('_id')
                .lean();
            if (existingClient) {
                req.flash(
                    'error_msg',
                    'Email này đã đăng ký tài khoản hội viên. Vui lòng đăng nhập để xem lịch tập và hợp đồng.'
                );
                const redirectAfterR1 = leadSource === 'Contact' ? '/contact' : '/auth/login';
                return res.redirect(redirectAfterR1);
            }
        }

        const lead = await Lead.create({
            name,
            phone,
            email,
            branch: branchId,
            interestedPackage: pkg,
            notes,
            weight: Number(weight) || undefined,
            height: Number(height) || undefined,
            bodyFat: Number(bodyFat) || undefined,
            muscleMass: Number(muscleMass) || undefined,
            targetGoal: targetGoal || undefined,
            source: leadSource
        });

        await notifyLeadCreated(lead, branchId, name, pkg);

        req.flash(
            'success_msg',
            'Bạn đã gửi thông tin thành công! Nhân viên FitCity sẽ liên hệ lại trong 24h.'
        );
        const safeRedirect =
            typeof redirectTo === 'string' && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
                ? redirectTo
                : leadSource === 'Contact'
                  ? '/contact'
                  : '/#trial';
        res.redirect(safeRedirect);
    } catch (err) {
        req.flash('error_msg', 'Vui lòng kiểm tra lại thông tin. Đảm bảo số điện thoại chính xác.');
        const failRedirect =
            req.body && req.body.source === 'Contact' ? '/contact' : '/';
        res.redirect(failRedirect);
    }
};

const { getPagination } = require('../../../utils/paginationHelper');

/** @param {string} [ymd] */
function parseYmdLocalStart(ymd) {
    if (!ymd || typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return null;
    const [y, m, d] = ymd.trim().split('-').map((n) => parseInt(n, 10));
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

/** @param {string} [ymd] */
function parseYmdLocalEnd(ymd) {
    if (!ymd || typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return null;
    const [y, m, d] = ymd.trim().split('-').map((n) => parseInt(n, 10));
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Gắn điều kiện createdAt theo khoảng ngày (input type=date, theo giờ local server).
 * @param {Record<string, unknown>} filter
 * @param {string} [dateFrom]
 * @param {string} [dateTo]
 */
function applyCreatedAtRange(filter, dateFrom, dateTo) {
    const fromStr = typeof dateFrom === 'string' ? dateFrom : '';
    const toStr = typeof dateTo === 'string' ? dateTo : '';
    let from = parseYmdLocalStart(fromStr);
    let to = parseYmdLocalEnd(toStr);
    if (from && to && from > to) {
        from = parseYmdLocalStart(toStr);
        to = parseYmdLocalEnd(fromStr);
    }
    if (!from && !to) return;
    const range = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    filter.createdAt = range;
}

/**
 * [Admin] Xem danh sách Leads (có hỗ trợ lọc qua query string)
 */
exports.getAllLeads = async (req, res, next) => {
    try {
        const { status, interestedPackage, source, dateFrom, dateTo } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const filter = {};
        if (status && status !== 'all') filter.status = status;
        if (interestedPackage && interestedPackage !== 'all') filter.interestedPackage = interestedPackage;
        if (source && source !== 'all') filter.source = source;
        applyCreatedAtRange(filter, dateFrom, dateTo);

        const totalDocs = await Lead.countDocuments(filter);
        const leads = await Lead.find(filter)
            .populate('branch', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const pagination = getPagination(totalDocs, page, limit);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const leadsToday = await Lead.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } });

        const totalLeadsAllTime = await Lead.countDocuments();
        const totalLeadPipelineSigned = await Lead.countDocuments({ status: 'Signed' });
        const totalPaidActiveContracts = await Contract.countDocuments({
            contractStatus: 'Active',
            paymentStatus: 'Paid'
        });
        const signRate =
            totalLeadsAllTime > 0
                ? ((totalPaidActiveContracts / totalLeadsAllTime) * 100).toFixed(1)
                : '0';
        const funnel = await getFunnelCounts(filter);

        res.render('admin/leads/list', {
            leads,
            pagination,
            activePage: 'leads',
            leadsToday,
            totalSigned: totalPaidActiveContracts,
            totalLeadPipelineSigned,
            signRate,
            funnel,
            currentFilter: {
                status: status || 'all',
                interestedPackage: interestedPackage || 'all',
                source: source || 'all',
                dateFrom: typeof dateFrom === 'string' ? dateFrom : '',
                dateTo: typeof dateTo === 'string' ? dateTo : ''
            },
            query: req.query
        });
    } catch (err) {
        next(err);
    }
};

/**
 * [Admin] Xuất Excel danh sách Leads
 */
exports.exportLeadsExcel = async (req, res, next) => {
    try {
        const { status, interestedPackage, source, dateFrom, dateTo } = req.query;

        const filter = {};
        if (status && status !== 'all') filter.status = status;
        if (interestedPackage && interestedPackage !== 'all') filter.interestedPackage = interestedPackage;
        if (source && source !== 'all') filter.source = source;
        applyCreatedAtRange(filter, dateFrom, dateTo);

        const leads = await Lead.find(filter).populate('branch', 'name').sort({ createdAt: -1 });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'FitCity System';
        const sheet = workbook.addWorksheet('Leads');

        sheet.columns = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Ngày đăng ký', key: 'date', width: 18 },
            { header: 'Họ tên', key: 'name', width: 25 },
            { header: 'SĐT', key: 'phone', width: 18 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Gói quan tâm', key: 'package', width: 14 },
            { header: 'Chi nhánh', key: 'branch', width: 22 },
            { header: 'Nguồn', key: 'source', width: 12 },
            { header: 'Trạng thái', key: 'status', width: 16 },
            { header: 'Ghi chú', key: 'notes', width: 30 },
        ];

        sheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const statusMap = {
            F: 'Khách F',
            Contacted: 'Đã liên hệ',
            Signed: 'Đã ký HĐ',
            Converted: 'Đã chuyển hội viên'
        };

        leads.forEach((lead, idx) => {
            sheet.addRow({
                stt: idx + 1,
                date: new Date(lead.createdAt).toLocaleDateString('vi-VN'),
                name: lead.name,
                phone: lead.phone,
                email: lead.email || '',
                package: lead.interestedPackage,
                branch: lead.branch ? lead.branch.name : 'N/A',
                source: lead.source,
                status: statusMap[lead.status] || lead.status,
                notes: lead.notes || ''
            });
        });

        const fileName = `Leads_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};

/**
 * [Admin] Xem chi tiết Khách Hàng Tiềm Năng (Lead)
 */
exports.getDetail = async (req, res, next) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate('branch', 'name address phone')
            .populate('convertedClientId', 'name email')
            .lean();
        if (!lead) {
            req.flash('error_msg', 'Không tìm thấy hồ sơ khách hàng tiềm năng!');
            return res.redirect('/admin/leads');
        }
        res.render('admin/leads/detail', { lead, activePage: 'leads' });
    } catch (err) {
        next(err);
    }
};

exports.updateLeadStatus = async (req, res, next) => {
    try {
        const existing = await Lead.findById(req.params.id).select('status').lean();
        if (!existing) {
            req.flash('error_msg', 'Không tìm thấy lead.');
            return res.redirect('/admin/leads');
        }
        if (existing.status === 'Converted') {
            req.flash('error_msg', 'Lead đã chuyển hội viên — không đổi trạng thái tại đây.');
            return res.redirect(`/admin/leads/detail/${req.params.id}`);
        }

        const { status, notes } = req.body;
        const allowed = ['F', 'Contacted', 'Signed'];
        if (!allowed.includes(status)) {
            req.flash('error_msg', 'Trạng thái không hợp lệ.');
            return res.redirect(`/admin/leads/detail/${req.params.id}`);
        }
        const update = { status };
        if (typeof notes === 'string' && notes.trim()) update.notes = notes.trim();
        const lead = await Lead.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!lead) {
            req.flash('error_msg', 'Không tìm thấy lead.');
            return res.redirect('/admin/leads');
        }
        req.flash('success_msg', 'Đã cập nhật trạng thái lead.');
        res.redirect(`/admin/leads/detail/${req.params.id}`);
    } catch (err) {
        next(err);
    }
};

/**
 * Đường B (R2): Convert Lead → User Client (staff CRM).
 */
exports.convertLeadToClient = async (req, res, next) => {
    const detailUrl = `/admin/leads/detail/${req.params.id}`;
    const redirectBack = () => res.redirect(detailUrl);

    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) {
            req.flash('error_msg', 'Không tìm thấy lead.');
            return res.redirect('/admin/leads');
        }
        if (lead.status === 'Converted' || lead.convertedClientId) {
            req.flash('error_msg', 'Lead này đã được chuyển thành hội viên.');
            return redirectBack();
        }

        const email = typeof lead.email === 'string' ? lead.email.trim() : '';
        if (!email) {
            req.flash(
                'error_msg',
                'Lead chưa có email — cập nhật hồ sơ hoặc nhập email trước khi tạo tài khoản hội viên.'
            );
            return redirectBack();
        }

        const { password, confirmPassword } = req.body;
        if (!password || password.length < 6) {
            req.flash('error_msg', 'Mật khẩu hội viên phải có ít nhất 6 ký tự.');
            return redirectBack();
        }
        if (password !== confirmPassword) {
            req.flash('error_msg', 'Mật khẩu xác nhận không khớp.');
            return redirectBack();
        }

        const client = await clientManagementService.createClient({
            name: lead.name.trim(),
            email,
            password,
            phone: lead.phone || undefined,
            branch: lead.branch,
            status: 'Active'
        });
        await sendClientWelcomeEmail(client, 'lead_convert');

        lead.status = 'Converted';
        lead.convertedClientId = client._id;
        await lead.save();

        req.flash('success_msg', 'Đã tạo tài khoản hội viên và liên kết với lead.');
        return redirectBack();
    } catch (err) {
        if (err.name === 'ClientServiceError' && err.code === 'DUPLICATE_EMAIL') {
            req.flash('error_msg', err.message);
            return redirectBack();
        }
        next(err);
    }
};

