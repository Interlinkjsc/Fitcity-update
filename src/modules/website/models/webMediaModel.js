const mongoose = require('mongoose');

const webMediaSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, trim: true },
    filename: { type: String, default: '' },
    alt: { type: String, default: '' },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },
    grp: { type: String, default: 'general', trim: true },
}, { timestamps: true, collection: 'web_media' });

module.exports = mongoose.model('WebMedia', webMediaSchema);
