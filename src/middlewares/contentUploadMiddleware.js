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

    // Tracks pending file writes so `finish` only calls next() after every
    // file's WriteStream has actually closed (avoids race condition where
    // the controller reads req.contentUpload before the write completes).
    const pendingWrites = [];
    let busboyFinished = false;
    let settled = false;

    function maybeNext() {
        if (settled) return;
        if (busboyFinished && pendingWrites.every((p) => p.done)) {
            settled = true;
            next();
        }
    }

    busboy.on('file', (fieldname, file, info) => {
        if (fieldname !== 'mediaFile') {
            file.resume();
            return;
        }
        ensureDir();
        const safeName = `${Date.now()}_${(info.filename || 'file').replace(/[^\w.\-]/g, '_')}`;
        const dest = path.join(uploadDir, safeName);
        const writeStream = fs.createWriteStream(dest);
        const pending = { done: false };
        pendingWrites.push(pending);

        file.pipe(writeStream);

        writeStream.on('close', () => {
            req.contentUpload = {
                path: dest,
                fileName: info.filename || safeName,
                publicUrl: `/uploads/content/${safeName}`
            };
            pending.done = true;
            maybeNext();
        });

        writeStream.on('error', (err) => {
            if (settled) return;
            settled = true;
            next(err);
        });
    });

    busboy.on('field', (name, value) => {
        req.body[name] = value;
    });
    busboy.on('finish', () => {
        busboyFinished = true;
        maybeNext();
    });
    busboy.on('error', (err) => {
        if (settled) return;
        settled = true;
        next(err);
    });
    req.pipe(busboy);
}

module.exports = { contentUploadMiddleware, uploadDir };
