const SiteContent = require('../models/siteContentModel');
const { slugify, ensureUniqueSlug } = require('../services/cmsService');
const permissionService = require('../../../core/permissionService');

exports.getList = async (req, res, next) => {
    try {
        const { type } = req.query;
        const filter = {};
        if (type && type !== 'all') filter.type = type;
        const items = await SiteContent.find(filter).sort({ updatedAt: -1 }).limit(100);
        await permissionService.ensureCache();
        const canManageCms = permissionService.userHasPermissionSync(req.session.user, 'cms', 'manage');
        res.render('admin/cms/list', {
            items,
            activePage: 'cms',
            currentType: type || 'all',
            canManageCms
        });
    } catch (err) {
        next(err);
    }
};

exports.getCreateForm = async (req, res, next) => {
    try {
        res.render('admin/cms/form', { item: null, activePage: 'cms' });
    } catch (err) {
        next(err);
    }
};

exports.store = async (req, res, next) => {
    try {
        const { type, title, key, slug, excerpt, body, imageUrl, seoTitle, seoDescription, published } = req.body;
        const isPublished = published === 'on' || published === 'true';
        let finalSlug = slug ? slugify(slug) : slugify(title);
        if (type === 'post') finalSlug = await ensureUniqueSlug(finalSlug);

        await SiteContent.create({
            type,
            title,
            key: key || undefined,
            slug: type === 'post' ? finalSlug : undefined,
            excerpt,
            body,
            imageUrl,
            seoTitle,
            seoDescription,
            published: isPublished,
            publishedAt: isPublished ? new Date() : undefined,
            author: req.user._id
        });
        req.flash('success_msg', 'Đã tạo nội dung CMS.');
        res.redirect('/admin/cms');
    } catch (err) {
        next(err);
    }
};

exports.getEditForm = async (req, res, next) => {
    try {
        const item = await SiteContent.findById(req.params.id);
        if (!item) {
            req.flash('error_msg', 'Không tìm thấy nội dung.');
            return res.redirect('/admin/cms');
        }
        res.render('admin/cms/form', { item, activePage: 'cms' });
    } catch (err) {
        next(err);
    }
};

exports.update = async (req, res, next) => {
    try {
        const item = await SiteContent.findById(req.params.id);
        if (!item) {
            req.flash('error_msg', 'Không tìm thấy nội dung.');
            return res.redirect('/admin/cms');
        }
        const { type, title, key, slug, excerpt, body, imageUrl, seoTitle, seoDescription, published } = req.body;
        const isPublished = published === 'on' || published === 'true';
        item.type = type;
        item.title = title;
        item.key = key || undefined;
        item.excerpt = excerpt;
        item.body = body;
        item.imageUrl = imageUrl;
        item.seoTitle = seoTitle;
        item.seoDescription = seoDescription;
        if (type === 'post') {
            const base = slug ? slugify(slug) : slugify(title);
            item.slug = await ensureUniqueSlug(base, item._id);
        }
        if (isPublished && !item.published) item.publishedAt = new Date();
        item.published = isPublished;
        await item.save();
        req.flash('success_msg', 'Đã cập nhật nội dung.');
        res.redirect('/admin/cms');
    } catch (err) {
        next(err);
    }
};

exports.delete = async (req, res, next) => {
    try {
        await SiteContent.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Đã xóa nội dung.');
        res.redirect('/admin/cms');
    } catch (err) {
        next(err);
    }
};
