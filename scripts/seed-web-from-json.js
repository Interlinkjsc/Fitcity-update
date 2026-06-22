/**
 * seed-web-from-json.js
 *
 * Reads /tmp/d1-export.json and inserts into MongoDB
 * WebBranch, WebProgram, WebPost, WebSetting collections.
 * Skips a collection entirely if it already has documents (idempotent).
 *
 * Usage:
 *   node scripts/seed-web-from-json.js
 *   node scripts/seed-web-from-json.js /path/to/custom-export.json
 *
 * Expected input format:
 * {
 *   "branches": [...],
 *   "programs": [...],
 *   "posts":    [...],
 *   "settings": [{"key":"...","value":"..."}]
 * }
 *
 * Branch fields mapped from D1 → MongoDB:
 *   id, slug, name, address, city, district, phone, hours,
 *   metric, coach, image_key→imageUrl, is_main→isMain, sort, published
 *
 * Program fields:
 *   id, slug, name, age→ages, tagline, summary, body, accent,
 *   image_key→imageUrl, sort, published
 *
 * Post fields:
 *   id, slug, title, excerpt, body_md→body, hero_key→heroImage,
 *   status, published_at→publishedAt, tags
 */

'use strict';

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const INPUT_FILE = process.argv[2] || '/tmp/d1-export.json';

const WebBranch = require('../src/modules/website/models/webBranchModel');
const WebProgram = require('../src/modules/website/models/webProgramModel');
const WebPost = require('../src/modules/website/models/webPostModel');
const WebSetting = require('../src/modules/website/models/webSettingModel');

function slugify(s) {
    return (s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function seedBranches(data) {
    const existing = await WebBranch.countDocuments();
    if (existing > 0) {
        console.log(`  Branches: skipped (${existing} docs already exist)`);
        return 0;
    }
    if (!data || !data.length) {
        console.log('  Branches: skipped (no data in input)');
        return 0;
    }
    const docs = data.map(b => ({
        name: b.name || '',
        slug: b.slug || slugify(b.name),
        address: b.address || '',
        city: b.city || '',
        district: b.district || '',
        phone: b.phone || '',
        hours: b.hours || '',
        metric: b.metric || '',
        coach: b.coach || '',
        imageUrl: b.image_key || b.imageUrl || '',
        isMain: !!(b.is_main || b.isMain),
        sort: Number(b.sort) || 0,
        published: b.published !== false && b.published !== 0,
    }));
    await WebBranch.insertMany(docs, { ordered: false });
    return docs.length;
}

async function seedPrograms(data) {
    const existing = await WebProgram.countDocuments();
    if (existing > 0) {
        console.log(`  Programs: skipped (${existing} docs already exist)`);
        return 0;
    }
    if (!data || !data.length) {
        console.log('  Programs: skipped (no data in input)');
        return 0;
    }
    const docs = data.map(p => ({
        name: p.name || '',
        slug: p.slug || slugify(p.name),
        ages: p.ages || p.age || '',
        tagline: p.tagline || '',
        summary: p.summary || '',
        body: p.body || p.body_md || '',
        accent: p.accent || '#c3d500',
        imageUrl: p.image_key || p.imageUrl || '',
        sort: Number(p.sort) || 0,
        published: p.published !== false && p.published !== 0,
    }));
    await WebProgram.insertMany(docs, { ordered: false });
    return docs.length;
}

async function seedPosts(data) {
    const existing = await WebPost.countDocuments();
    if (existing > 0) {
        console.log(`  Posts: skipped (${existing} docs already exist)`);
        return 0;
    }
    if (!data || !data.length) {
        console.log('  Posts: skipped (no data in input)');
        return 0;
    }
    const docs = data.map(p => {
        const status = p.status === 'published' ? 'published' : 'draft';
        const publishedAt = p.published_at ? new Date(p.published_at)
            : (p.publishedAt ? new Date(p.publishedAt) : null);
        return {
            title: p.title || '',
            slug: p.slug || slugify(p.title),
            excerpt: p.excerpt || '',
            body: p.body_md || p.body || '',
            heroImage: p.hero_key || p.heroImage || '',
            tags: Array.isArray(p.tags) ? p.tags : [],
            status,
            publishedAt: status === 'published' ? (publishedAt || new Date()) : null,
        };
    });
    await WebPost.insertMany(docs, { ordered: false });
    return docs.length;
}

async function seedSettings(data) {
    const existing = await WebSetting.countDocuments();
    if (existing > 0) {
        console.log(`  Settings: skipped (${existing} docs already exist)`);
        return 0;
    }
    if (!data || !data.length) {
        console.log('  Settings: skipped (no data in input)');
        return 0;
    }
    const docs = data.map(s => ({
        key: String(s.key || ''),
        value: String(s.value ?? ''),
        group: s.group || 'general',
    })).filter(s => s.key);
    await WebSetting.insertMany(docs, { ordered: false });
    return docs.length;
}

async function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Input file not found: ${INPUT_FILE}`);
        process.exit(1);
    }

    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    } catch (e) {
        console.error('Failed to parse JSON:', e.message);
        process.exit(1);
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not set (checked .env.local)');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB:', mongoose.connection.name);
    console.log('Seeding from:', INPUT_FILE);

    const [branches, programs, posts, settings] = await Promise.all([
        seedBranches(parsed.branches),
        seedPrograms(parsed.programs),
        seedPosts(parsed.posts),
        seedSettings(parsed.settings),
    ]);

    await mongoose.disconnect();
    console.log(`Seeded ${branches} branches, ${programs} programs, ${posts} posts, ${settings} settings`);
}

main().catch(err => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
