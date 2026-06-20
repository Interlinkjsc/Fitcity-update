const WebBranch = require('../models/webBranchModel');
const WebProgram = require('../models/webProgramModel');
const WebPost = require('../models/webPostModel');
const WebSetting = require('../models/webSettingModel');

function slugify(s) {
    return (s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
    const [branches, programs, posts, drafts] = await Promise.all([
        WebBranch.countDocuments(),
        WebProgram.countDocuments(),
        WebPost.countDocuments({ status: 'published' }),
        WebPost.countDocuments({ status: 'draft' }),
    ]);
    res.render('admin/website/index', {
        title: 'Quản lý Website', activePage: 'website',
        stats: { branches, programs, posts, drafts }
    });
};

// ── Branches ─────────────────────────────────────────────────────────────────
exports.getBranches = async (req, res) => {
    const branches = await WebBranch.find().sort({ sort: 1, createdAt: 1 });
    res.render('admin/website/branches', { title: 'Chi nhánh Website', activePage: 'website', branches });
};

exports.createBranch = async (req, res) => {
    res.render('admin/website/branch-form', { title: 'Thêm Chi nhánh', activePage: 'website', branch: null });
};

exports.storeBranch = async (req, res) => {
    try {
        const { name, address, city, district, phone, hours, metric, coach, imageUrl, isMain, sort, published } = req.body;
        const slug = slugify(name);
        await WebBranch.create({ name, slug, address, city, district, phone, hours, metric, coach, imageUrl, isMain: !!isMain, sort: parseInt(sort) || 0, published: !!published });
        req.flash('success', 'Đã thêm chi nhánh website.');
        res.redirect('/admin/website/branches');
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('/admin/website/branches/create');
    }
};

exports.editBranch = async (req, res) => {
    const branch = await WebBranch.findById(req.params.id);
    if (!branch) { req.flash('error', 'Không tìm thấy.'); return res.redirect('/admin/website/branches'); }
    res.render('admin/website/branch-form', { title: 'Sửa Chi nhánh', activePage: 'website', branch });
};

exports.updateBranch = async (req, res) => {
    try {
        const { name, address, city, district, phone, hours, metric, coach, imageUrl, isMain, sort, published } = req.body;
        await WebBranch.findByIdAndUpdate(req.params.id, { name, slug: slugify(name), address, city, district, phone, hours, metric, coach, imageUrl, isMain: !!isMain, sort: parseInt(sort) || 0, published: published === 'on' || published === 'true' || published === '1' });
        req.flash('success', 'Đã cập nhật chi nhánh.');
        res.redirect('/admin/website/branches');
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('/admin/website/branches/edit/' + req.params.id);
    }
};

exports.deleteBranch = async (req, res) => {
    await WebBranch.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xoá chi nhánh.');
    res.redirect('/admin/website/branches');
};

// ── Programs ─────────────────────────────────────────────────────────────────
exports.getPrograms = async (req, res) => {
    const programs = await WebProgram.find().sort({ sort: 1 });
    res.render('admin/website/programs', { title: 'Chương trình Website', activePage: 'website', programs });
};

exports.createProgram = async (req, res) => {
    res.render('admin/website/program-form', { title: 'Thêm Chương trình', activePage: 'website', program: null });
};

exports.storeProgram = async (req, res) => {
    try {
        const { name, ages, tagline, summary, body, accent, imageUrl, sort, published } = req.body;
        await WebProgram.create({ name, slug: slugify(name), ages, tagline, summary, body, accent: accent || '#c3d500', imageUrl, sort: parseInt(sort) || 0, published: !!published });
        req.flash('success', 'Đã thêm chương trình.');
        res.redirect('/admin/website/programs');
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('/admin/website/programs/create');
    }
};

exports.editProgram = async (req, res) => {
    const program = await WebProgram.findById(req.params.id);
    if (!program) { req.flash('error', 'Không tìm thấy.'); return res.redirect('/admin/website/programs'); }
    res.render('admin/website/program-form', { title: 'Sửa Chương trình', activePage: 'website', program });
};

exports.updateProgram = async (req, res) => {
    try {
        const { name, ages, tagline, summary, body, accent, imageUrl, sort, published } = req.body;
        await WebProgram.findByIdAndUpdate(req.params.id, { name, slug: slugify(name), ages, tagline, summary, body, accent: accent || '#c3d500', imageUrl, sort: parseInt(sort) || 0, published: published === 'on' || published === 'true' || published === '1' });
        req.flash('success', 'Đã cập nhật chương trình.');
        res.redirect('/admin/website/programs');
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('/admin/website/programs/edit/' + req.params.id);
    }
};

exports.deleteProgram = async (req, res) => {
    await WebProgram.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xoá chương trình.');
    res.redirect('/admin/website/programs');
};

// ── Posts ────────────────────────────────────────────────────────────────────
exports.getPosts = async (req, res) => {
    const posts = await WebPost.find().sort({ createdAt: -1 }).populate('author', 'name');
    res.render('admin/website/posts', { title: 'Bài viết Website', activePage: 'website', posts });
};

exports.createPost = async (req, res) => {
    res.render('admin/website/post-form', { title: 'Thêm Bài viết', activePage: 'website', post: null });
};

exports.storePost = async (req, res) => {
    try {
        const { title, excerpt, body, heroImage, tags, status } = req.body;
        const slug = slugify(title);
        const publishedAt = status === 'published' ? new Date() : null;
        await WebPost.create({ title, slug, excerpt, body, heroImage, tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [], status, publishedAt, author: req.session.user.id });
        req.flash('success', 'Đã thêm bài viết.');
        res.redirect('/admin/website/posts');
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('/admin/website/posts/create');
    }
};

exports.editPost = async (req, res) => {
    const post = await WebPost.findById(req.params.id);
    if (!post) { req.flash('error', 'Không tìm thấy.'); return res.redirect('/admin/website/posts'); }
    res.render('admin/website/post-form', { title: 'Sửa Bài viết', activePage: 'website', post });
};

exports.updatePost = async (req, res) => {
    try {
        const { title, excerpt, body, heroImage, tags, status } = req.body;
        const post = await WebPost.findById(req.params.id);
        const publishedAt = status === 'published' && !post.publishedAt ? new Date() : post.publishedAt;
        await WebPost.findByIdAndUpdate(req.params.id, { title, slug: slugify(title), excerpt, body, heroImage, tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [], status, publishedAt });
        req.flash('success', 'Đã cập nhật bài viết.');
        res.redirect('/admin/website/posts');
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('/admin/website/posts/edit/' + req.params.id);
    }
};

exports.deletePost = async (req, res) => {
    await WebPost.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xoá bài viết.');
    res.redirect('/admin/website/posts');
};

// ── Settings ──────────────────────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
    const rows = await WebSetting.find().sort({ group: 1, key: 1 });
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.render('admin/website/settings', { title: 'Cấu hình Website', activePage: 'website', settings });
};

exports.updateSettings = async (req, res) => {
    try {
        const KEYS = ['site_name', 'site_tagline', 'contact_phone', 'contact_email', 'contact_address', 'facebook_url', 'zalo_url', 'hero_title', 'hero_subtitle', 'meta_description'];
        const ops = KEYS.map(k => ({
            updateOne: { filter: { key: k }, update: { $set: { key: k, value: req.body[k] || '', group: 'general' } }, upsert: true }
        }));
        await WebSetting.bulkWrite(ops);
        req.flash('success', 'Đã lưu cài đặt website.');
        res.redirect('/admin/website/settings');
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('/admin/website/settings');
    }
};
