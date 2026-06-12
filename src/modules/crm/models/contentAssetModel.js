const mongoose = require('mongoose');

const contentAssetSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: String,
        mediaType: {
            type: String,
            enum: ['image', 'video', 'text'],
            default: 'image'
        },
        fileUrl: String,
        googleDriveFileId: String,
        tags: [String],
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('ContentAsset', contentAssetSchema);
