const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Google Drive Auth Config
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
 * Get Google Drive Client
 */
const getDriveClient = async () => {
    try {
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../../../config/google-credentials.json');
        
        if (!fs.existsSync(credentialsPath)) {
            console.warn('[GDrive Service] Credentials file not found. Falling back to MOCK mode.');
            return null;
        }

        const auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: SCOPES,
        });

        return google.drive({ version: 'v3', auth });
    } catch (err) {
        console.error('[GDrive Service] Auth Error:', err);
        return null;
    }
};

/**
 * REAL Google Drive Upload
 */
exports.uploadToDrive = async (filePath, fileName, folderId) => {
    try {
        const drive = await getDriveClient();
        
        // If no credentials, use mock for local dev
        if (!drive) {
            console.log(`[GDrive Mock] Simulating upload for ${fileName}...`);
            await new Promise(r => setTimeout(r, 1000));
            return `mock_drive_id_${Date.now()}`;
        }

        const fileMetadata = {
            name: fileName,
            parents: folderId ? [folderId] : []
        };
        const media = {
            mimeType: 'application/pdf',
            body: fs.createReadStream(filePath)
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        });

        console.log(`[GDrive Service] File uploaded to Cloud. ID: ${response.data.id}`);
        return response.data.id;
    } catch (err) {
        console.error('[GDrive Service] Upload Failed:', err);
        // PM SPEC: Local Storage Cache fallback
        const cacheDir = path.join(__dirname, '../../../tmp/contracts');
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        
        const cachePath = path.join(cacheDir, `OFFLINE_${Date.now()}_${fileName}`);
        fs.copyFileSync(filePath, cachePath);
        console.warn(`[GDrive Service] Contract cached locally at: ${cachePath}. Synchronize later!`);
        
        return `OFFLINE_CACHE_${Date.now()}`;
    }
};

/**
 * Update contract record with the uploaded G-Drive file ID
 */
exports.attachDriveIdToContract = async (contractId, fileId) => {
    const Contract = require('../../contracts/models/contractModel.js');
    try {
        await Contract.findByIdAndUpdate(contractId, { googleDriveFileId: fileId });
        return true;
    } catch (err) {
        console.error('[GDrive Service] DB Update Failed:', err);
        return false;
    }
};

exports.attachDriveIdToExpense = async (expenseId, fileId) => {
    const Expense = require('../../finance/models/expenseModel.js');
    try {
        await Expense.findByIdAndUpdate(expenseId, { googleDriveFileId: fileId });
        return true;
    } catch (err) {
        console.error('[GDrive Service] Expense DB Update Failed:', err);
        return false;
    }
};

exports.getDriveViewUrl = (fileId) => {
    if (!fileId || String(fileId).startsWith('OFFLINE_CACHE_')) return null;
    return `https://drive.google.com/file/d/${fileId}/view`;
};
