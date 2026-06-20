const mongoose = require('mongoose');

const webBranchSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    district: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    hours: { type: String, trim: true, default: '' },
    metric: { type: String, trim: true, default: '' },
    coach: { type: String, trim: true, default: '' },
    imageUrl: { type: String, default: '' },
    isMain: { type: Boolean, default: false },
    sort: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
}, { timestamps: true, collection: 'web_branches' });

module.exports = mongoose.model('WebBranch', webBranchSchema);
