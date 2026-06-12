const JobDescriptionTemplate = require('../models/jobDescriptionTemplateModel.js');
const registry = require('../../../core/permissionsRegistry');

exports.getList = async (req, res, next) => {
    try {
        const templates = await JobDescriptionTemplate.find().sort({ role: 1, title: 1 });
        res.render('admin/job-descriptions/list', {
            templates,
            roleLabels: registry.ROLE_LABELS
        });
    } catch (err) {
        next(err);
    }
};

exports.getCreateForm = async (req, res, next) => {
    try {
        res.render('admin/job-descriptions/form', {
            isEdit: false,
            template: { items: [''] },
            roles: registry.ASSIGNABLE_ROLES.filter((r) => r !== 'Client'),
            roleLabels: registry.ROLE_LABELS
        });
    } catch (err) {
        next(err);
    }
};

exports.getEditForm = async (req, res, next) => {
    try {
        const template = await JobDescriptionTemplate.findById(req.params.id);
        if (!template) {
            req.flash('error_msg', 'Không tìm thấy mô tả công việc.');
            return res.redirect('/admin/job-descriptions');
        }
        res.render('admin/job-descriptions/form', {
            isEdit: true,
            template,
            roles: registry.ASSIGNABLE_ROLES.filter((r) => r !== 'Client'),
            roleLabels: registry.ROLE_LABELS
        });
    } catch (err) {
        next(err);
    }
};

exports.store = async (req, res, next) => {
    try {
        const { role, title, items, active } = req.body;
        const itemList = []
            .concat(items)
            .map((s) => String(s || '').trim())
            .filter(Boolean);

        await JobDescriptionTemplate.create({
            role,
            title: title?.trim(),
            items: itemList,
            active: active === 'on' || active === true
        });

        req.flash('success_msg', 'Đã tạo mô tả công việc (JD).');
        res.redirect('/admin/job-descriptions');
    } catch (err) {
        next(err);
    }
};

exports.update = async (req, res, next) => {
    try {
        const template = await JobDescriptionTemplate.findById(req.params.id);
        if (!template) {
            req.flash('error_msg', 'Không tìm thấy.');
            return res.redirect('/admin/job-descriptions');
        }

        const { role, title, items, active } = req.body;
        const itemList = []
            .concat(items)
            .map((s) => String(s || '').trim())
            .filter(Boolean);

        template.role = role;
        template.title = title?.trim();
        template.items = itemList;
        template.active = active === 'on' || active === true;
        await template.save();

        req.flash('success_msg', 'Đã cập nhật JD.');
        res.redirect('/admin/job-descriptions');
    } catch (err) {
        next(err);
    }
};

exports.delete = async (req, res, next) => {
    try {
        await JobDescriptionTemplate.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Đã xóa JD.');
        res.redirect('/admin/job-descriptions');
    } catch (err) {
        next(err);
    }
};

/** API: JD theo role cho form user */
exports.getByRoleApi = async (req, res, next) => {
    try {
        const { role } = req.query;
        if (!role) {
            return res.status(400).json({ status: 'fail', message: 'Thiếu role' });
        }
        const templates = await JobDescriptionTemplate.find({ role, active: true })
            .select('title items')
            .sort({ title: 1 })
            .lean();
        res.json({ status: 'success', data: templates });
    } catch (err) {
        next(err);
    }
};
