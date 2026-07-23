const path = require('path');
const fs = require('fs');
const Busboy = require('busboy');

// Bug 23/7 A16: nhận file .xlsx/.csv để import danh sách khách hàng.
const uploadDir = process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, 'imports')
    : path.join(__dirname, '../../uploads/imports');
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXT = ['.xlsx', '.csv'];

function clientImportUploadMiddleware(req, res, next) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('multipart/form-data')) return next();

    const busboy = Busboy({ headers: req.headers, limits: { fileSize: MAX_BYTES, files: 1 } });
    req.body = {};
    req.importFile = null;
    let uploadError = null;

    busboy.on('field', (name, val) => { req.body[name] = val; });
    busboy.on('file', (fieldname, file, info) => {
        if (fieldname !== 'importFile') { file.resume(); return; }
        const ext = path.extname(info.filename || '').toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
            uploadError = 'Chỉ chấp nhận file .xlsx hoặc .csv';
            file.resume();
            return;
        }
        fs.mkdirSync(uploadDir, { recursive: true });
        const dest = path.join(uploadDir, `${Date.now()}_${(info.filename || 'kh').replace(/[^\w.\-]/g, '_')}`);
        const ws = fs.createWriteStream(dest);
        file.pipe(ws);
        file.on('limit', () => { uploadError = 'File vượt quá 8MB.'; ws.destroy(); fs.unlink(dest, () => {}); });
        file.on('end', () => { if (!uploadError) req.importFile = { path: dest, filename: info.filename }; });
    });
    busboy.on('finish', () => {
        if (uploadError) {
            req.flash('error_msg', uploadError);
            return res.redirect('/admin/clients/list');
        }
        next();
    });
    busboy.on('error', (err) => next(err));
    req.pipe(busboy);
}

module.exports = { clientImportUploadMiddleware };
