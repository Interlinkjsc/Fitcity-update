const mongoose = require('mongoose');
const ChecklistTask = require('../models/checklistTaskModel.js');
const Branch = require('../../crm/models/branchModel.js');
const User = require('../../users/models/userModel.js');
const notificationService = require('../services/notificationService');
const { getPagination } = require('../../../utils/paginationHelper');

function buildListFilter(user, query) {
    const filter = {};
    const { status, branchId, assigneeId } = query;

    if (status && status !== 'all') filter.status = status;
    if (assigneeId && assigneeId !== 'all') filter.assignee = assigneeId;

    if (user.role === 'Manager' && user.branch) {
        filter.branch = user.branch;
    } else if (branchId && branchId !== 'all') {
        filter.branch = branchId;
    }

    return filter;
}

exports.getList = async (req, res, next) => {
    try {
        const user = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 15;
        const skip = (page - 1) * limit;
        const filter = buildListFilter(user, req.query);

        const [totalDocs, tasks, branches, staff] = await Promise.all([
            ChecklistTask.countDocuments(filter),
            ChecklistTask.find(filter)
                .populate('assignee', 'name role avatar')
                .populate('branch', 'name')
                .populate('createdBy', 'name')
                .sort({ dueDate: 1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Branch.find({ status: 'Open' }).select('name').sort({ name: 1 }),
            User.find({
                role: { $in: ['PT', 'Sales', 'Manager', 'Marketing', 'Accountant', 'Admin'] },
                status: 'Active',
                ...(user.role === 'Manager' && user.branch ? { branch: user.branch } : {})
            })
                .select('name role branch')
                .sort({ name: 1 })
        ]);

        res.render('admin/checklists/list', {
            tasks,
            branches,
            staff,
            pagination: getPagination(totalDocs, page, limit),
            currentFilter: req.query
        });
    } catch (err) {
        next(err);
    }
};

exports.getCreateForm = async (req, res, next) => {
    try {
        const user = req.session.user;
        const branches = await Branch.find({ status: 'Open' }).sort({ name: 1 });
        const staffFilter =
            user.role === 'Manager' && user.branch
                ? { branch: user.branch, status: 'Active', role: { $ne: 'Client' } }
                : { status: 'Active', role: { $ne: 'Client' } };
        const staff = await User.find(staffFilter).select('name role').sort({ name: 1 });

        res.render('admin/checklists/form', {
            isEdit: false,
            task: {},
            branches,
            staff
        });
    } catch (err) {
        next(err);
    }
};

exports.getEditForm = async (req, res, next) => {
    try {
        const task = await ChecklistTask.findById(req.params.id);
        if (!task) {
            req.flash('error_msg', 'Không tìm thấy công việc.');
            return res.redirect('/admin/checklists');
        }

        const user = req.session.user;
        if (user.role === 'Manager' && user.branch && task.branch?.toString() !== user.branch.toString()) {
            req.flash('error_msg', 'Bạn không có quyền sửa công việc chi nhánh khác.');
            return res.redirect('/admin/checklists');
        }

        const branches = await Branch.find({ status: 'Open' }).sort({ name: 1 });
        const staff = await User.find({ status: 'Active', role: { $ne: 'Client' } })
            .select('name role')
            .sort({ name: 1 });

        res.render('admin/checklists/form', {
            isEdit: true,
            task,
            branches,
            staff
        });
    } catch (err) {
        next(err);
    }
};

exports.store = async (req, res, next) => {
    try {
        const user = req.session.user;
        const { title, description, branchId, assigneeId, dueDate, status, priority } = req.body;

        const task = await ChecklistTask.create({
            title: title?.trim(),
            description: description?.trim(),
            branch: branchId || user.branch || undefined,
            assignee: assigneeId || undefined,
            createdBy: user.id,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            status: status || 'Todo',
            priority: priority || 'Medium'
        });

        if (task.assignee) {
            await notificationService.pushNotification(
                task.assignee,
                'Checklist mới',
                `Bạn được giao: ${task.title}`,
                'Info',
                '/admin/checklists'
            );
        }

        req.flash('success_msg', 'Đã tạo công việc checklist.');
        res.redirect('/admin/checklists');
    } catch (err) {
        next(err);
    }
};

exports.update = async (req, res, next) => {
    try {
        const task = await ChecklistTask.findById(req.params.id);
        if (!task) {
            req.flash('error_msg', 'Không tìm thấy công việc.');
            return res.redirect('/admin/checklists');
        }

        const user = req.session.user;
        if (user.role === 'Manager' && user.branch && task.branch?.toString() !== user.branch.toString()) {
            req.flash('error_msg', 'Không có quyền.');
            return res.redirect('/admin/checklists');
        }

        const { title, description, branchId, assigneeId, dueDate, status, priority } = req.body;
        const prevAssignee = task.assignee?.toString();

        task.title = title?.trim() || task.title;
        task.description = description?.trim();
        if (branchId) task.branch = branchId;
        task.assignee = assigneeId || undefined;
        task.dueDate = dueDate ? new Date(dueDate) : undefined;
        task.status = status || task.status;
        task.priority = priority || task.priority;
        await task.save();

        if (task.assignee && task.assignee.toString() !== prevAssignee) {
            await notificationService.pushNotification(
                task.assignee,
                'Checklist được giao',
                `Bạn được giao: ${task.title}`,
                'Info',
                '/admin/checklists'
            );
        }

        req.flash('success_msg', 'Đã cập nhật công việc.');
        res.redirect('/admin/checklists');
    } catch (err) {
        next(err);
    }
};

exports.delete = async (req, res, next) => {
    try {
        await ChecklistTask.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Đã xóa công việc.');
        res.redirect('/admin/checklists');
    } catch (err) {
        next(err);
    }
};
