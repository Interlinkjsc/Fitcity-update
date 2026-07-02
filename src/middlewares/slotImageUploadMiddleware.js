const path = require('path');
const fs = require('fs');
const Busboy = require('busboy');

// Ảnh website (CMS) — lưu ngoài container qua volume (UPLOAD_DIR), phục vụ tại /uploads
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_BYTES = 5 * 1024 * 1024;

function slotImageUploadMiddleware(req, res, next) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('multipart/form-data')) return next();

    const busboy = Busboy({ headers: req.headers, limits: { fileSize: MAX_BYTES, files: 1 } });
    req.body = {};
    req.slotUpload = null;
    let uploadError = null;

    busboy.on('field', (name, val) => { req.body[name] = val; });

    busboy.on('file', (fieldname, file, info) => {
        if (fieldname !== 'imageFile') { file.resume(); return; }
        const ext = ALLOWED[info.mimeType];
        if (!ext) {
            uploadError = 'Chỉ chấp nhận ảnh JPG / PNG / WEBP.';
            file.resume();
            return;
        }
        const slotDir = path.join(uploadDir, 'slots');
        fs.mkdirSync(slotDir, { recursive: true });
        const key = `slots/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const dest = path.join(uploadDir, key);
        const ws = fs.createWriteStream(dest);
        file.pipe(ws);
        file.on('limit', () => {
            uploadError = 'Ảnh vượt quá 5MB.';
            ws.destroy();
            fs.unlink(dest, () => {});
        });
        file.on('end', () => {
            if (!uploadError) {
                req.slotUpload = { key, path: dest, filename: info.filename || key, mimeType: info.mimeType };
            }
        });
    });

    busboy.on('finish', () => {
        if (uploadError) {
            req.flash('error_msg', uploadError);
            return res.redirect('/admin/website/settings');
        }
        next();
    });
    busboy.on('error', (err) => next(err));
    req.pipe(busboy);
}

module.exports = { slotImageUploadMiddleware, uploadDir };
