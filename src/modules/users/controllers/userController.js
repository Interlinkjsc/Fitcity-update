const mongoose = require('mongoose');
const User = require('../models/userModel.js');
const Branch = require('../../crm/models/branchModel.js');
const { getPagination } = require('../../../utils/paginationHelper');
const kpiService = require('../../platform/services/kpiService');
const permissionService = require('../../../core/permissionService');
const registry = require('../../../core/permissionsRegistry');
const JobDescriptionTemplate = require('../../platform/models/jobDescriptionTemplateModel.js');

async function applyJobDescriptionFromTemplate(userData, body) {
    if (!body.jobDescriptionTemplateId) return;
    const tpl = await JobDescriptionTemplate.findById(body.jobDescriptionTemplateId).lean();
    if (tpl && Array.isArray(tpl.items) && tpl.items.length) {
        userData.jobDescription = tpl.items;
    }
}

function applyCommissionFields(target, body) {
    const clampPct = (raw, fallback) => {
        if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return fallback;
        return Math.min(100, n);
    };
    if (body.ptCommissionRate !== undefined) {
        target.ptCommissionRate = clampPct(body.ptCommissionRate, 10);
    }
    if (body.salesCommissionRate !== undefined) {
        target.salesCommissionRate = clampPct(body.salesCommissionRate, 5);
    }
}

// 1. Hiển thị danh sách nhân sự (Staff)
exports.getUserList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Lấy tất cả trừ Client (Chỉ lọc nhân sự nội bộ)
        const filters = { role: { $ne: 'Client' } }; 

        // [RBAC] Branch Isolation: Manager chỉ thấy nhân viên chi nhánh mình
        if (req.session.user.role === 'Manager') {
            const myBranchId = req.session.user.branch;
            if (myBranchId) {
                filters.branch = myBranchId;
            } else {
                // Nếu Manager không có chi nhánh (lỗi data), chặn không cho thấy ai
                filters.branch = new mongoose.Types.ObjectId(); 
            }
        }

        const totalDocs = await User.countDocuments(filters);
        const users = await User.find(filters)
            .populate('branch', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const pagination = getPagination(totalDocs, page, limit);

        res.render('admin/users/list', { 
            users,
            pagination,
            query: req.query
        });
    } catch (err) {
        next(err);
    }
};

// 2. Form Tạo mới
exports.getCreateForm = async (req, res, next) => {
    try {
        const branches = await Branch.find();
        const assignableRoles = permissionService.getAssignableRolesForActor(req.session.user.role);
        const defaultRole = assignableRoles.includes('PT') ? 'PT' : assignableRoles[0];
        const userPermissionPreview = await permissionService.getUserPermissionSummary({
            role: defaultRole,
            useCustomPermissions: false,
            customPermissionIds: []
        });

        const userData = new User();
        userData.role = defaultRole;

        res.render('admin/users/form', {
            isEdit: false,
            userData,
            defaultRole,
            branches,
            assignableRoles,
            roleLabels: registry.ROLE_LABELS,
            userPermissionPreview,
            permissionGroups: registry.getPermissionsGrouped(),
            canEditUserPermissions: permissionService.canEditUserPermissions(req.session.user.role),
            isSa: req.session.user.role === 'SA'
        });
    } catch (err) {
        next(err);
    }
};

/** API: quyền theo role (form tạo/sửa tài khoản) */
exports.getRolePermissionsApi = async (req, res, next) => {
    try {
        const { role } = req.query;
        if (!role) {
            return res.status(400).json({ status: 'fail', message: 'Thiếu tham số role' });
        }
        const summary = await permissionService.getRolePermissionSummary(role);
        if (!summary) {
            return res.status(404).json({ status: 'fail', message: 'Vai trò không hợp lệ' });
        }
        res.json({ status: 'success', data: summary });
    } catch (err) {
        next(err);
    }
};

// 3. Xử lý Thêm mới
exports.storeUser = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        const { encrypt, decrypt, hash } = require('../../../utils/encryption');
        // Kiểm tra trùng email
        const existing = await User.findOne({ emailHash: hash(email) });
        if (existing) {
            req.flash('error_msg', 'Email này đã được sử dụng!');
            return res.redirect('/admin/users/create');
        }

        permissionService.assertCanAssignRole(req.session.user.role, req.body.role);

        const userData = { ...req.body };
        if (!userData.branch) {
            delete userData.branch;
        }

        const permFields = permissionService.parsePermissionFieldsFromBody(req.body);
        if (req.body.role === 'SA') {
            permFields.useCustomPermissions = false;
            permFields.customPermissionIds = [];
        } else if (permFields.useCustomPermissions) {
            await permissionService.assertCanGrantPermissions(req.session.user, permFields.customPermissionIds);
        }
        userData.useCustomPermissions = permFields.useCustomPermissions;
        userData.customPermissionIds = permFields.customPermissionIds;
        applyCommissionFields(userData, req.body);
        await applyJobDescriptionFromTemplate(userData, req.body);

        await User.create(userData);
        req.flash('success_msg', `Tạo tài khoản nhân viên mới thành công! (Vai trò: ${registry.ROLE_LABELS[userData.role] || userData.role})`);
        res.redirect('/admin/users/list');
    } catch (err) {
        if (err.message && (err.message.includes('không có quyền gán') || err.message.includes('không thể cấp quyền'))) {
            req.flash('error_msg', err.message);
            return res.redirect('/admin/users/create');
        }
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message).join(', ');
            req.flash('error_msg', messages);
            return res.redirect('/admin/users/create');
        }
        next(err);
    }
};

// 4. Form Chỉnh sửa
exports.getEditForm = async (req, res, next) => {
    try {
        const userData = await User.findById(req.params.id);
        if (!userData) {
            req.flash('error_msg', 'Không tìm thấy nhân viên này!');
            return res.redirect('/admin/users/list');
        }
        const branches = await Branch.find();
        const assignableRoles = permissionService.getAssignableRolesForActor(req.session.user.role);
        const userPermissionPreview = await permissionService.getUserPermissionSummary({
            role: userData.role,
            useCustomPermissions: userData.useCustomPermissions,
            customPermissionIds: userData.customPermissionIds || []
        });

        res.render('admin/users/form', {
            isEdit: true,
            userData,
            branches,
            assignableRoles,
            roleLabels: registry.ROLE_LABELS,
            userPermissionPreview,
            permissionGroups: registry.getPermissionsGrouped(),
            canEditUserPermissions: permissionService.canEditUserPermissions(req.session.user.role),
            isSa: req.session.user.role === 'SA'
        });
    } catch (err) {
        next(err);
    }
};

// 5. Xử lý Cập nhật
exports.updateUser = async (req, res, next) => {
    try {
        const userId = req.params.id;
        
        // Nếu admin không điền mật khẩu mới, ta bỏ field password ra khỏi update object
        const updateData = { ...req.body };
        if (!updateData.password || updateData.password.trim() === '') {
            delete updateData.password;
        }
        if (!updateData.branch) {
            updateData.branch = undefined;
        }

        // Email check unique exception cho user hiện tại
        if (updateData.email) {
            const { hash } = require('../../../utils/encryption');
            const existing = await User.findOne({ emailHash: hash(updateData.email), _id: { $ne: userId } });
            if (existing) {
                req.flash('error_msg', 'Email cập nhật bị trùng lặp với người khác!');
                return res.redirect(`/admin/users/edit/${userId}`);
            }
        }

        const updatedUser = await User.findById(userId);
        if (!updatedUser) {
            req.flash('error_msg', 'Cập nhật thất bại. Không tìm thấy tài khoản!');
            return res.redirect('/admin/users/list');
        }

        if (updateData.role) {
            permissionService.assertCanAssignRole(req.session.user.role, updateData.role);
        }

        const permFields = permissionService.parsePermissionFieldsFromBody(req.body);
        const targetRole = updateData.role || updatedUser.role;
        if (targetRole === 'SA') {
            permFields.useCustomPermissions = false;
            permFields.customPermissionIds = [];
        } else if (permFields.useCustomPermissions) {
            await permissionService.assertCanGrantPermissions(req.session.user, permFields.customPermissionIds);
        }
        updateData.useCustomPermissions = permFields.useCustomPermissions;
        updateData.customPermissionIds = permFields.customPermissionIds;
        applyCommissionFields(updateData, req.body);
        await applyJobDescriptionFromTemplate(updateData, req.body);

        // Apply fields and trigger 'save' for pre-save hook (tốt cho Hash Password)
        Object.keys(updateData).forEach((key) => {
            if (key !== 'jobDescriptionTemplateId') {
                updatedUser[key] = updateData[key];
            }
        });
        if (updateData.jobDescription) {
            updatedUser.jobDescription = updateData.jobDescription;
        }
        
        await updatedUser.save({ runValidators: true });

        req.flash('success_msg', 'Cập nhật thông tin Hồ sơ Nhân sự thành công!');
        res.redirect('/admin/users/list');
    } catch (err) {
        if (err.message && (err.message.includes('không có quyền gán') || err.message.includes('không thể cấp quyền'))) {
            req.flash('error_msg', err.message);
            return res.redirect(`/admin/users/edit/${req.params.id}`);
        }
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message).join(', ');
            req.flash('error_msg', messages);
            return res.redirect(`/admin/users/edit/${req.params.id}`);
        }
        next(err);
    }
};

// 6. Xử lý xóa
exports.deleteUser = async (req, res, next) => {
    try {
        // To-do logic: Có thể soft-delete hoặc khoá tài khoản thay vì Hard Delete nếu dính tới Payroll
        const deleted = await User.findByIdAndDelete(req.params.id);
        if (!deleted) {
            req.flash('error_msg', 'Không tìm thấy tài khoản nhân viên!');
        } else {
            req.flash('success_msg', 'Xóa tài khoản nhân viên thành công!');
        }
        res.redirect('/admin/users/list');
    } catch (err) {
        next(err);
    }
};

// 7. Chi tiết Nhân sự
exports.getDetail = async (req, res, next) => {
    try {
        const userData = await User.findById(req.params.id)
            .populate('branch', 'name address');
            
        if (!userData) {
            req.flash('error_msg', 'Không tìm thấy nhân viên này!');
            return res.redirect('/admin/users/list');
        }

        if (req.session.user.role === 'Manager') {
            const myBranch = req.session.user.branch?.toString();
            const staffBranch = userData.branch?._id?.toString() || userData.branch?.toString();
            const isSelf = userData._id.toString() === req.session.user.id?.toString();
            if (!isSelf && myBranch && staffBranch && staffBranch !== myBranch) {
                req.flash('error_msg', 'Bạn chỉ được xem nhân sự thuộc chi nhánh của mình.');
                return res.redirect('/admin/users/list');
            }
            if (!isSelf && myBranch && !staffBranch) {
                req.flash('error_msg', 'Nhân sự này chưa được gán chi nhánh.');
                return res.redirect('/admin/users/list');
            }
        }

        // Fetch contracts managed by this user if PT
        const Contract = require('../../contracts/models/contractModel.js');
        const WorkoutSession = require('../../programs/models/workoutSessionModel.js');

        let sessionsThisMonth = 0;
        if (userData.role === 'PT') {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            sessionsThisMonth = await WorkoutSession.countDocuments({
                pt: userData._id,
                status: 'Completed',
                scheduledTime: { $gte: startOfMonth }
            });
        }

        const managedContracts = await Contract.find({ pt: userData._id })
            .populate('client', 'name email')
            .select('contractCode contractStatus paymentStatus netAmount totalAmount createdAt')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        const kpiMonth = parseInt(req.query.kpiMonth, 10) || (new Date().getMonth() + 1);
        const kpiYear = parseInt(req.query.kpiYear, 10) || new Date().getFullYear();

        let employeeKPI = null;
        let employeeKPITarget = null;
        if (['PT', 'Sales', 'Manager'].includes(userData.role)) {
            try {
                employeeKPI = await kpiService.getEmployeeKPI(userData, kpiMonth, kpiYear);
            } catch (kpiErr) {
                console.error('Error fetching employee KPI:', kpiErr.message);
                employeeKPI = null;
            }
        }
        if (['PT', 'Sales'].includes(userData.role)) {
            employeeKPITarget = await kpiService.getEmployeeKPITargetRecord(userData._id, kpiMonth, kpiYear);
        }

        const canSetEmployeeKPI = permissionService.userHasPermissionSync(req.session.user, 'kpi', 'manage');

        res.render('admin/users/detail', {
            userData,
            managedContracts,
            employeeKPI,
            employeeKPITarget,
            canSetEmployeeKPI,
            kpiMonth,
            kpiYear,
            sessionsThisMonth
        });
    } catch (err) {
        next(err);
    }
};

/** Gán chỉ tiêu KPI cá nhân (PT / Sales) */
exports.saveEmployeeKPITarget = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const userData = await User.findById(userId);
        if (!userData) {
            req.flash('error_msg', 'Không tìm thấy nhân viên.');
            return res.redirect('/admin/users/list');
        }
        if (!['PT', 'Sales'].includes(userData.role)) {
            req.flash('error_msg', 'Chỉ gán chỉ tiêu KPI cho PT hoặc Sales.');
            return res.redirect(`/admin/users/detail/${userId}`);
        }
        if (req.session.user.role === 'Manager') {
            const myBranch = req.session.user.branch?.toString();
            const staffBranch = userData.branch?.toString();
            if (myBranch && staffBranch && staffBranch !== myBranch) {
                req.flash('error_msg', 'Bạn chỉ được gán chỉ tiêu cho nhân sự chi nhánh mình.');
                return res.redirect(`/admin/users/detail/${userId}`);
            }
        }

        const { kpiMonth, kpiYear } = req.body;
        await kpiService.saveEmployeeKPITarget(userData._id, req.body, req.session.user.id);

        req.flash('success_msg', 'Đã lưu chỉ tiêu KPI cá nhân.');
        res.redirect(`/admin/users/detail/${userId}?kpiMonth=${kpiMonth}&kpiYear=${kpiYear}`);
    } catch (err) {
        req.flash('error_msg', err.message);
        res.redirect(`/admin/users/detail/${req.params.id}`);
    }
};

/**
 * 8. PASSWORD SELF-SERVICE (Mọi User tự đổi được)
 */
exports.updateMyPassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.session.user.id).select('+password');

        if (!user) {
            if (req.xhr) return res.status(404).json({ status: 'error', message: 'Không tìm thấy người dùng' });
            req.flash('error_msg', 'Không tìm thấy người dùng');
            return res.redirect('back');
        }

        // Kiểm tra mật khẩu hiện tại
        const isMatch = await user.correctPassword(currentPassword, user.password);
        if (!isMatch) {
            if (req.xhr) return res.status(400).json({ status: 'error', message: 'Mật khẩu hiện tại không chính xác!' });
            req.flash('error_msg', 'Mật khẩu hiện tại không chính xác!');
            return res.redirect('back');
        }

        // Kiểm tra khớp mật khẩu mới
        if (newPassword !== confirmPassword) {
            if (req.xhr) return res.status(400).json({ status: 'error', message: 'Xác nhận mật khẩu mới không khớp!' });
            req.flash('error_msg', 'Xác nhận mật khẩu mới không khớp!');
            return res.redirect('back');
        }

        if (newPassword.length < 6) {
            if (req.xhr) return res.status(400).json({ status: 'error', message: 'Mật khẩu phải có ít nhất 6 ký tự!' });
            req.flash('error_msg', 'Mật khẩu phải có ít nhất 6 ký tự!');
            return res.redirect('back');
        }

        // Cập nhật
        user.password = newPassword;
        await user.save();

        if (req.xhr) return res.json({ status: 'success', message: 'Đổi mật khẩu thành công!' });
        
        req.flash('success_msg', 'Đổi mật khẩu thành công!');
        res.redirect('back');
    } catch (err) {
        if (req.xhr) return res.status(500).json({ status: 'error', message: 'Lỗi hệ thống: ' + err.message });
        next(err);
    }
};
