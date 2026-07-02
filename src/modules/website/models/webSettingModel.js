const mongoose = require('mongoose');

const webSettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('WebSetting', webSettingSchema);
