const ContentAsset = require('../models/contentAssetModel');
const driveService = require('../../platform/services/driveService');

exports.getList = async (req, res, next) => {
    try {
        const assets = await ContentAsset.find()
            .populate('uploadedBy', 'name')
            .sort({ createdAt: -1 })
            .limit(80);
        res.render('admin/content-library/list', { assets, activePage: 'content_library' });
    } catch (err) {
        next(err);
    }
};

exports.store = async (req, res, next) => {
    try {
        const { title, description, mediaType, tags } = req.body;
        const tagList = tags
            ? String(tags)
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
            : [];

        const payload = {
            title,
            description,
            mediaType: mediaType || 'image',
            tags: tagList,
            uploadedBy: req.user._id
        };

        if (req.contentUpload) {
            payload.fileUrl = req.contentUpload.publicUrl;
            try {
                const driveId = await driveService.uploadToDrive(
                    req.contentUpload.path,
                    req.contentUpload.fileName,
                    process.env.GDRIVE_CONTENT_FOLDER_ID
                );
                if (driveId) payload.googleDriveFileId = driveId;
            } catch {
                /* Drive optional */
            }
        }

        await ContentAsset.create(payload);
        req.flash('success_msg', 'Đã thêm tài nguyên nội dung.');
        res.redirect('/admin/content-library');
    } catch (err) {
        next(err);
    }
};

exports.delete = async (req, res, next) => {
    try {
        await ContentAsset.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Đã xóa tài nguyên.');
        res.redirect('/admin/content-library');
    } catch (err) {
        next(err);
    }
};
