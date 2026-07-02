/**
 * Seed nội dung website (chi nhánh / chương trình / bài viết) vào Mongo
 * từ fixtures copy từ fitcity-web. IDEMPOTENT: chỉ tạo khi slug chưa tồn tại —
 * KHÔNG ghi đè chỉnh sửa của khách qua CMS.
 *
 * Chạy: node src/seeds/seedWebContent.js  (cần MONGODB_URI trong env/.env)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const WebBranch = require('../modules/website/models/webBranchModel');
const WebProgram = require('../modules/website/models/webProgramModel');
const WebPost = require('../modules/website/models/webPostModel');

const FIXTURES = path.join(__dirname, 'fixtures');

function parseFrontmatter(md) {
    const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) return { data: {}, body: md };
    const data = {};
    for (const line of m[1].split('\n')) {
        const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
        if (!kv) continue;
        let v = kv[2].trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        data[kv[1]] = v;
    }
    return { data, body: m[2] };
}

async function seed() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity';
    await mongoose.connect(uri);
    console.log('[seedWebContent] connected:', uri.replace(/\/\/.*@/, '//***@'));

    // Branches
    const branches = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'web-branches.json'), 'utf8'));
    let created = 0;
    for (let i = 0; i < branches.length; i++) {
        const b = branches[i];
        const exists = await WebBranch.findOne({ slug: b.slug });
        if (exists) continue;
        await WebBranch.create({
            name: b.name, slug: b.slug, address: b.address || '', city: b.city || '',
            district: b.district || '', phone: b.phone || '', hours: b.hours || '',
            metric: b.metric || '', coach: b.coach || '',
            isMain: b.type === 'main', sort: i, published: true
        });
        created++;
    }
    console.log(`[seedWebContent] branches: +${created} (tổng ${branches.length})`);

    // Programs
    const programs = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'web-programs.json'), 'utf8'));
    created = 0;
    for (let i = 0; i < programs.length; i++) {
        const p = programs[i];
        const exists = await WebProgram.findOne({ slug: p.slug });
        if (exists) continue;
        await WebProgram.create({
            name: p.name, slug: p.slug, ages: p.ages || '', tagline: p.tagline || '',
            summary: p.summary || '', body: p.body || '', accent: p.accent || '#c3d500',
            sort: i, published: true
        });
        created++;
    }
    console.log(`[seedWebContent] programs: +${created} (tổng ${programs.length})`);

    // Posts
    const blogDir = path.join(FIXTURES, 'web-blog');
    const files = fs.existsSync(blogDir) ? fs.readdirSync(blogDir).filter(f => f.endsWith('.md')) : [];
    created = 0;
    for (const f of files) {
        const slug = f.replace(/\.md$/, '');
        const exists = await WebPost.findOne({ slug });
        if (exists) continue;
        const { data, body } = parseFrontmatter(fs.readFileSync(path.join(blogDir, f), 'utf8'));
        await WebPost.create({
            title: data.title || slug,
            slug,
            excerpt: data.description || '',
            body,
            status: 'published',
            publishedAt: data.pubDate ? new Date(data.pubDate) : new Date()
        });
        created++;
    }
    console.log(`[seedWebContent] posts: +${created} (tổng ${files.length})`);

    await mongoose.disconnect();
    console.log('[seedWebContent] DONE');
}

seed().catch(err => { console.error('[seedWebContent] FAIL:', err); process.exit(1); });
