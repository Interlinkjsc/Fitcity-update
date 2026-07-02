const path = require('path');
const fs = require('fs');
const Busboy = require('busboy');

// /app/uploads/expenses — writable by the fitcity process
const uploadDir = path.join(__dirname, '../../uploads/expenses');

function ensureUploadDir() {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
}

/** Parse multipart form; file field `invoiceFile` → req.expenseUpload */
function expenseUploadMiddleware(req, res, next) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('multipart/form-data')) {
        return next();
    }

    const busboy = Busboy({ headers: req.headers });
    req.body = {};
    req.expenseUpload = null;

    busboy.on('file', (fieldname, file, info) => {
        if (fieldname !== 'invoiceFile' || !info.filename) {
            file.resume();
            return;
        }
        try {
            ensureUploadDir();
        } catch (dirErr) {
            file.resume();
            return;
        }
        const safeName = `${Date.now()}_${info.filename.replace(/[^\w.\-]/g, '_')}`;
        const dest = path.join(uploadDir, safeName);
        const writeStream = fs.createWriteStream(dest);
        file.pipe(writeStream);
        writeStream.on('close', () => {
            req.expenseUpload = {
                path: dest,
                fileName: info.filename,
                publicUrl: `/uploads/expenses/${safeName}`
            };
        });
        writeStream.on('error', () => { file.resume(); });
    });

    busboy.on('field', (name, value) => {
        req.body[name] = value;
    });

    busboy.on('finish', () => next());
    busboy.on('error', (err) => next(err));
    req.pipe(busboy);
}

module.exports = { expenseUploadMiddleware, uploadDir };
