const mongoose = require('mongoose');

const webPostSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    excerpt: { type: String, default: '' },
    body: { type: String, default: '' },
    heroImage: { type: String, default: '' },
    tags: [{ type: String, trim: true }],
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date, default: null },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, collection: 'web_posts' });

webPostSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('WebPost', webPostSchema);
