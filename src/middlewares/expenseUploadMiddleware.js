const path = require('path');
const fs = require('fs');
const Busboy = require('busboy');

const uploadDir = path.join(__dirname, '../public/uploads/expenses');

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
        if (fieldname !== 'invoiceFile') {
            file.resume();
            return;
        }
        ensureUploadDir();
        const safeName = `${Date.now()}_${(info.filename || 'invoice').replace(/[^\w.\-]/g, '_')}`;
        const dest = path.join(uploadDir, safeName);
        const writeStream = fs.createWriteStream(dest);
        file.pipe(writeStream);
        writeStream.on('close', () => {
            req.expenseUpload = {
                path: dest,
                fileName: info.filename || safeName,
                publicUrl: `/uploads/expenses/${safeName}`
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

module.exports = { expenseUploadMiddleware, uploadDir };
