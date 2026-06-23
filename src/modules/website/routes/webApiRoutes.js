const express = require('express');
const router = express.Router();
const WebBranch = require('../models/webBranchModel');
const WebProgram = require('../models/webProgramModel');
const WebPost = require('../models/webPostModel');
const WebSetting = require('../models/webSettingModel');
const WebMedia = require('../models/webMediaModel');
const WebSlotImage = require('../models/webSlotImageModel');

// ── Auth middleware for write endpoints ──────────────────────────────────────
function requireAdminKey(req, res, next) {
    const key = process.env.WEB_ADMIN_KEY;
    if (!key) return res.status(503).json({ error: 'WEB_ADMIN_KEY not configured on server' });
    if (req.headers['x-admin-key'] !== key) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

// ── Shared slugify ────────────────────────────────────────────────────────────
function slugify(s) {
    return (s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Map helpers (keep in sync with existing GET handlers) ────────────────────
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
        published: b.published,
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
        published: p.published,
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

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC GET endpoints (unchanged + extended)
// ═══════════════════════════════════════════════════════════════════════════════

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

// GET by MongoDB _id (admin edit load)
router.get('/branches-by-id/:id', async (req, res) => {
    try {
        const b = await WebBranch.findById(req.params.id);
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

// GET by MongoDB _id (admin edit load)
router.get('/programs-by-id/:id', async (req, res) => {
    try {
        const p = await WebProgram.findById(req.params.id);
        if (!p) return res.status(404).json({ error: 'Not found' });
        res.json(mapProgram(p));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /posts — public returns published only; ?all=1 (with admin key) returns all
router.get('/posts', async (req, res) => {
    try {
        const wantsAll = req.query.all === '1';
        const key = process.env.WEB_ADMIN_KEY;
        const authed = key && req.headers['x-admin-key'] === key;
        const filter = (wantsAll && authed) ? {} : { status: 'published' };
        const posts = await WebPost.find(filter)
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

// GET by MongoDB _id (admin edit load, returns draft too)
router.get('/posts-by-id/:id', async (req, res) => {
    try {
        const p = await WebPost.findById(req.params.id).populate('author', 'name');
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

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN WRITE endpoints — require X-Admin-Key header
// ═══════════════════════════════════════════════════════════════════════════════

// ── Branches ──────────────────────────────────────────────────────────────────

router.post('/admin/branches', requireAdminKey, async (req, res) => {
    try {
        const { name, slug, address, city, district, phone, hours, metric, coach, image_key, sort, is_main, published } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        const finalSlug = (slug || '').trim() || slugify(name);
        const doc = await WebBranch.create({
            name, slug: finalSlug, address, city, district, phone, hours, metric, coach,
            imageUrl: image_key || '',
            isMain: !!is_main,
            sort: Number(sort) || 0,
            published: published !== false && published !== 'false',
        });
        res.status(201).json(mapBranch(doc));
    } catch (err) {
        res.status(err.code === 11000 ? 409 : 500).json({ error: err.message });
    }
});

router.put('/admin/branches/:id', requireAdminKey, async (req, res) => {
    try {
        const { name, slug, address, city, district, phone, hours, metric, coach, image_key, sort, is_main, published } = req.body;
        const update = {
            ...(name !== undefined && { name }),
            ...(slug !== undefined ? { slug: slug || slugify(name) } : (name ? { slug: slugify(name) } : {})),
            ...(address !== undefined && { address }),
            ...(city !== undefined && { city }),
            ...(district !== undefined && { district }),
            ...(phone !== undefined && { phone }),
            ...(hours !== undefined && { hours }),
            ...(metric !== undefined && { metric }),
            ...(coach !== undefined && { coach }),
            ...(image_key !== undefined && { imageUrl: image_key }),
            ...(sort !== undefined && { sort: Number(sort) || 0 }),
            ...(is_main !== undefined && { isMain: !!is_main }),
            ...(published !== undefined && { published: published !== false && published !== 'false' }),
        };
        const doc = await WebBranch.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        if (!doc) return res.status(404).json({ error: 'Not found' });
        res.json(mapBranch(doc));
    } catch (err) {
        res.status(err.code === 11000 ? 409 : 500).json({ error: err.message });
    }
});

router.delete('/admin/branches/:id', requireAdminKey, async (req, res) => {
    try {
        const doc = await WebBranch.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true, id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Programs ──────────────────────────────────────────────────────────────────

router.post('/admin/programs', requireAdminKey, async (req, res) => {
    try {
        const { name, slug, age, ages, tagline, summary, body, accent, image_key, sort, published } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        const finalSlug = (slug || '').trim() || slugify(name);
        const doc = await WebProgram.create({
            name, slug: finalSlug,
            ages: ages || age || '',
            tagline: tagline || '',
            summary: summary || '',
            body: body || '',
            accent: accent || '#c3d500',
            imageUrl: image_key || '',
            sort: Number(sort) || 0,
            published: published !== false && published !== 'false',
        });
        res.status(201).json(mapProgram(doc));
    } catch (err) {
        res.status(err.code === 11000 ? 409 : 500).json({ error: err.message });
    }
});

router.put('/admin/programs/:id', requireAdminKey, async (req, res) => {
    try {
        const { name, slug, age, ages, tagline, summary, body, accent, image_key, sort, published } = req.body;
        const update = {
            ...(name !== undefined && { name }),
            ...(slug !== undefined ? { slug: slug || slugify(name) } : (name ? { slug: slugify(name) } : {})),
            ...((ages !== undefined || age !== undefined) && { ages: ages || age || '' }),
            ...(tagline !== undefined && { tagline }),
            ...(summary !== undefined && { summary }),
            ...(body !== undefined && { body }),
            ...(accent !== undefined && { accent: accent || '#c3d500' }),
            ...(image_key !== undefined && { imageUrl: image_key }),
            ...(sort !== undefined && { sort: Number(sort) || 0 }),
            ...(published !== undefined && { published: published !== false && published !== 'false' }),
        };
        const doc = await WebProgram.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        if (!doc) return res.status(404).json({ error: 'Not found' });
        res.json(mapProgram(doc));
    } catch (err) {
        res.status(err.code === 11000 ? 409 : 500).json({ error: err.message });
    }
});

router.delete('/admin/programs/:id', requireAdminKey, async (req, res) => {
    try {
        const doc = await WebProgram.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true, id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Posts ─────────────────────────────────────────────────────────────────────

router.post('/admin/posts', requireAdminKey, async (req, res) => {
    try {
        const { title, slug, excerpt, body_md, hero_key, status, tags } = req.body;
        if (!title) return res.status(400).json({ error: 'title is required' });
        const finalSlug = (slug || '').trim() || slugify(title);
        const finalStatus = status === 'published' ? 'published' : 'draft';
        const doc = await WebPost.create({
            title, slug: finalSlug,
            excerpt: excerpt || '',
            body: body_md || '',
            heroImage: hero_key || '',
            tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []),
            status: finalStatus,
            publishedAt: finalStatus === 'published' ? new Date() : null,
        });
        res.status(201).json(mapPost(doc));
    } catch (err) {
        res.status(err.code === 11000 ? 409 : 500).json({ error: err.message });
    }
});

router.put('/admin/posts/:id', requireAdminKey, async (req, res) => {
    try {
        const { title, slug, excerpt, body_md, hero_key, status, tags } = req.body;
        const existing = await WebPost.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Not found' });

        const finalStatus = status === 'published' ? 'published' : (status === 'draft' ? 'draft' : existing.status);
        const update = {
            ...(title !== undefined && { title }),
            ...(slug !== undefined ? { slug: slug || slugify(title) } : (title ? { slug: slugify(title) } : {})),
            ...(excerpt !== undefined && { excerpt }),
            ...(body_md !== undefined && { body: body_md }),
            ...(hero_key !== undefined && { heroImage: hero_key }),
            ...(status !== undefined && { status: finalStatus }),
            ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean) }),
        };
        // Auto-stamp publishedAt on first publish
        if (finalStatus === 'published' && !existing.publishedAt) {
            update.publishedAt = new Date();
        }
        const doc = await WebPost.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
            .populate('author', 'name');
        res.json(mapPost(doc));
    } catch (err) {
        res.status(err.code === 11000 ? 409 : 500).json({ error: err.message });
    }
});

router.delete('/admin/posts/:id', requireAdminKey, async (req, res) => {
    try {
        const doc = await WebPost.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true, id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Settings ──────────────────────────────────────────────────────────────────

// POST /api/web/admin/settings — upsert multiple key-value pairs
// Body: { "key1": "value1", "key2": "value2", ... }
router.post('/admin/settings', requireAdminKey, async (req, res) => {
    try {
        const entries = req.body;
        if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
            return res.status(400).json({ error: 'Body must be a key-value object' });
        }
        const ops = Object.entries(entries).map(([k, v]) => ({
            updateOne: {
                filter: { key: k },
                update: { $set: { key: k, value: String(v ?? ''), group: 'general' } },
                upsert: true,
            },
        }));
        if (ops.length) await WebSetting.bulkWrite(ops);
        const rows = await WebSetting.find();
        const result = {};
        rows.forEach(r => { result[r.key] = r.value; });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Media ─────────────────────────────────────────────────────────────────────

// GET /api/web/media — list media items, optional ?grp=<group>
router.get('/media', async (req, res) => {
    try {
        const filter = req.query.grp ? { grp: req.query.grp } : {};
        const items = await WebMedia.find(filter).sort({ createdAt: -1 }).lean();
        res.json(items.map(m => ({
            key: m.key,
            filename: m.filename || '',
            alt: m.alt || '',
            width: m.width || 0,
            height: m.height || 0,
            bytes: m.bytes || 0,
            grp: m.grp || 'general',
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/web/admin/media — add a media record (metadata only; R2 upload handled by CF worker)
router.post('/admin/media', requireAdminKey, async (req, res) => {
    try {
        const { key, filename, alt, width, height, bytes, grp } = req.body;
        if (!key) return res.status(400).json({ error: 'key required' });
        const doc = await WebMedia.findOneAndUpdate(
            { key },
            { key, filename: filename || '', alt: alt || '', width: width || 0,
              height: height || 0, bytes: bytes || 0, grp: grp || 'general' },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.status(201).json({ key: doc.key, filename: doc.filename, alt: doc.alt, grp: doc.grp });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/web/admin/media?key=<key> — remove media record; key passed as query param
// (avoids path-to-regexp wildcard issues with slash-containing R2 keys)
router.delete('/admin/media', requireAdminKey, async (req, res) => {
    try {
        const key = String(req.query.key || '');
        if (!key) return res.status(400).json({ error: 'key query param required' });
        await WebMedia.deleteOne({ key });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Slot Images ───────────────────────────────────────────────────────────────

// GET /api/web/slot-images — return { slotId: mediaKey } map
router.get('/slot-images', async (req, res) => {
    try {
        const rows = await WebSlotImage.find().lean();
        const map = {};
        rows.forEach(r => { map[r.slotId] = r.mediaKey; });
        res.json(map);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/web/admin/slot-images — upsert a slot → mediaKey mapping
// Body: { slot_id: string, media_key: string }
router.post('/admin/slot-images', requireAdminKey, async (req, res) => {
    try {
        const { slot_id, media_key } = req.body;
        if (!slot_id) return res.status(400).json({ error: 'slot_id required' });
        await WebSlotImage.findOneAndUpdate(
            { slotId: slot_id },
            { slotId: slot_id, mediaKey: media_key || '' },
            { upsert: true, new: true }
        );
        res.json({ ok: true, slotId: slot_id, mediaKey: media_key || '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
