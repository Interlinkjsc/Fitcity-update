const path = require('path');
const fs = require('fs');
const Busboy = require('busboy');

const uploadDir = path.join(__dirname, '../public/uploads/content');

function ensureDir() {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

function contentUploadMiddleware(req, res, next) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('multipart/form-data')) return next();

    const busboy = Busboy({ headers: req.headers });
    req.body = {};
    req.contentUpload = null;

    busboy.on('file', (fieldname, file, info) => {
        if (fieldname !== 'mediaFile') {
            file.resume();
            return;
        }
        ensureDir();
        const safeName = `${Date.now()}_${(info.filename || 'file').replace(/[^\w.\-]/g, '_')}`;
        const dest = path.join(uploadDir, safeName);
        file.pipe(fs.createWriteStream(dest));
        file.on('end', () => {
            req.contentUpload = {
                path: dest,
                fileName: info.filename || safeName,
                publicUrl: `/uploads/content/${safeName}`
            };
        });
    });

    busboy.on('field', (name, value) => {
        req.body[name] = value;
    });
    busboy.on('finish', () => next());
    busboy.on('error', (err) => next(err));
    req.pipe(busboy);
}

module.exports = { contentUploadMiddleware, uploadDir };
