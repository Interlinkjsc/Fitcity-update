const mongoose = require('mongoose');

const webProgramSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    ages: { type: String, trim: true, default: '' },
    tagline: { type: String, trim: true, default: '' },
    summary: { type: String, default: '' },
    body: { type: String, default: '' },
    accent: { type: String, default: '#c3d500' },
    imageUrl: { type: String, default: '' },
    sort: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
}, { timestamps: true, collection: 'web_programs' });

module.exports = mongoose.model('WebProgram', webProgramSchema);
