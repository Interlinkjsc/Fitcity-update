const mongoose = require('mongoose');

const siteContentSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            trim: true,
            sparse: true
        },
        type: {
            type: String,
            enum: ['banner', 'post', 'seo', 'section'],
            required: true
        },
        title: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, lowercase: true },
        excerpt: String,
        body: String,
        imageUrl: String,
        seoTitle: String,
        seoDescription: String,
        published: { type: Boolean, default: false },
        publishedAt: Date,
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

siteContentSchema.index({ type: 1, published: 1 });
siteContentSchema.index({ slug: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('SiteContent', siteContentSchema);
