const express = require('express');
const router = express.Router();
const WebBranch = require('../models/webBranchModel');
const WebProgram = require('../models/webProgramModel');
const WebPost = require('../models/webPostModel');
const WebSetting = require('../models/webSettingModel');

function mapBranch(b) {
    return {
        id: b._id.toString(),
        slug: b.slug,
        name: b.name,
        address: b.address || '',
        city: b.city || '',
        district: b.district || '',
        phone: b.phone || '',
        hours: b.hours || '',
        metric: b.metric || '',
        coach: b.coach || '',
        image_key: b.imageUrl || '',
        sort: b.sort || 0,
        is_main: b.isMain ? 1 : 0,
        geo: { lat: null, lng: null },
        type: b.isMain ? 'main' : 'franchise',
    };
}

function mapProgram(p) {
    return {
        id: p._id.toString(),
        slug: p.slug,
        name: p.name,
        age: p.ages || '',
        ages: p.ages || '',
        tagline: p.tagline || '',
        summary: p.summary || '',
        body: p.body || '',
        body_md: p.body || '',
        accent: p.accent || '#c3d500',
        image_key: p.imageUrl || '',
        sort: p.sort || 0,
    };
}

function mapPost(p) {
    return {
        id: p._id.toString(),
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt || '',
        body_md: p.body || '',
        hero_key: p.heroImage || '',
        status: p.status,
        published_at: p.publishedAt ? p.publishedAt.toISOString() : null,
        updated_at: p.updatedAt ? p.updatedAt.toISOString() : new Date().toISOString(),
        tags: p.tags || [],
        author: p.author ? p.author.name || '' : '',
    };
}

router.get('/branches', async (req, res) => {
    try {
        const branches = await WebBranch.find({ published: true }).sort({ sort: 1 });
        res.json(branches.map(mapBranch));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/branches/:slug', async (req, res) => {
    try {
        const b = await WebBranch.findOne({ slug: req.params.slug, published: true });
        if (!b) return res.status(404).json({ error: 'Not found' });
        res.json(mapBranch(b));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/programs', async (req, res) => {
    try {
        const programs = await WebProgram.find({ published: true }).sort({ sort: 1 });
        res.json(programs.map(mapProgram));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/programs/:slug', async (req, res) => {
    try {
        const p = await WebProgram.findOne({ slug: req.params.slug, published: true });
        if (!p) return res.status(404).json({ error: 'Not found' });
        res.json(mapProgram(p));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/posts', async (req, res) => {
    try {
        const posts = await WebPost.find({ status: 'published' })
            .sort({ publishedAt: -1 })
            .populate('author', 'name');
        res.json(posts.map(mapPost));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/posts/:slug', async (req, res) => {
    try {
        const p = await WebPost.findOne({ slug: req.params.slug, status: 'published' })
            .populate('author', 'name');
        if (!p) return res.status(404).json({ error: 'Not found' });
        res.json(mapPost(p));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/settings', async (req, res) => {
    try {
        const rows = await WebSetting.find();
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
