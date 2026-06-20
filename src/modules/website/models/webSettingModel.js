const mongoose = require('mongoose');

const webSettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: String, default: '' },
    label: { type: String, default: '' },
    group: { type: String, default: 'general' },
}, { timestamps: true, collection: 'web_settings' });

module.exports = mongoose.model('WebSetting', webSettingSchema);
