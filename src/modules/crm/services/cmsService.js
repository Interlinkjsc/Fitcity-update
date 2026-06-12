const SiteContent = require('../models/siteContentModel');

function slugify(text) {
    return String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

exports.slugify = slugify;

exports.getPublishedBanners = () =>
    SiteContent.find({ type: 'banner', published: true }).sort({ updatedAt: -1 }).limit(5);

exports.getHomeSeo = async () => {
    const seo = await SiteContent.findOne({ type: 'seo', key: 'home', published: true });
    return seo || null;
};

exports.getPublishedPosts = (limit = 12) =>
    SiteContent.find({ type: 'post', published: true })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(limit)
        .select('title slug excerpt imageUrl publishedAt createdAt');

exports.getPostBySlug = (slug) =>
    SiteContent.findOne({ type: 'post', slug, published: true });

exports.ensureUniqueSlug = async (slug, excludeId) => {
    if (!slug) return slugify(`post-${Date.now()}`);
    const filter = { slug };
    if (excludeId) filter._id = { $ne: excludeId };
    const exists = await SiteContent.findOne(filter);
    if (!exists) return slug;
    return `${slug}-${Date.now().toString(36).slice(-4)}`;
};
