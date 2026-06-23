const mongoose = require('mongoose');

const webSlotImageSchema = new mongoose.Schema({
    slotId: { type: String, required: true, unique: true, trim: true },
    mediaKey: { type: String, default: '', trim: true },
}, { timestamps: true, collection: 'web_slot_images' });

module.exports = mongoose.model('WebSlotImage', webSlotImageSchema);
