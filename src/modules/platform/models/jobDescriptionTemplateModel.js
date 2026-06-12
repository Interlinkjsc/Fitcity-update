const mongoose = require('mongoose');

const jobDescriptionTemplateSchema = new mongoose.Schema({
    role: {
        type: String,
        required: [true, 'Vai trò là bắt buộc'],
        trim: true
    },
    title: {
        type: String,
        required: [true, 'Tên mô tả là bắt buộc'],
        trim: true
    },
    items: [{
        type: String,
        trim: true
    }],
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

jobDescriptionTemplateSchema.index({ role: 1, title: 1 });

module.exports = mongoose.model('JobDescriptionTemplate', jobDescriptionTemplateSchema);
