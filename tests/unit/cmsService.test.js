const mongoose = require('mongoose');
const SiteContent = require('../../src/modules/crm/models/siteContentModel');
const cmsService = require('../../src/modules/crm/services/cmsService');

describe('cmsService', () => {
    beforeAll(async () => {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity_Test';
        if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    it('slugify normalizes vietnamese text', () => {
        expect(cmsService.slugify('Bài Viết Giảm Cân')).toBe('bai-viet-giam-can');
    });

    it('ensureUniqueSlug appends suffix when taken', async () => {
        const slug = `cms-test-${Date.now()}`;
        await SiteContent.create({
            type: 'post',
            title: 'Test',
            slug,
            published: false
        });
        const unique = await cmsService.ensureUniqueSlug(slug);
        expect(unique).not.toBe(slug);
        await SiteContent.deleteMany({ slug: { $in: [slug, unique] } });
    });

    it('getPublishedPosts returns only published posts', async () => {
        const key = `cms-pub-${Date.now()}`;
        await SiteContent.create({
            type: 'post',
            title: 'Draft',
            slug: `${key}-draft`,
            published: false
        });
        await SiteContent.create({
            type: 'post',
            title: 'Live',
            slug: `${key}-live`,
            published: true,
            publishedAt: new Date()
        });
        const posts = await cmsService.getPublishedPosts(50);
        const slugs = posts.map((p) => p.slug);
        expect(slugs).toContain(`${key}-live`);
        expect(slugs).not.toContain(`${key}-draft`);
        await SiteContent.deleteMany({ slug: { $regex: `^${key}` } });
    });
});
