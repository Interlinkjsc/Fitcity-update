const crypto = require('crypto');

// ENCRYPTION_KEY should be 32 bytes (256 bits). 
// In production, this MUST come from process.env.ENCRYPTION_KEY
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'f1tc1ty_sup3r_s3cr3t_k3y_32_byte'; 
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypt string using AES-256-CBC
 */
function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt string using AES-256-CBC
 */
function decrypt(text) {
    if (!text || !text.includes(':')) return text;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch {
        return null;
    }
}

/**
 * Hash string using SHA-256 (for indexing/searching)
 */
function hash(text) {
    if (!text) return text;
    return crypto.createHash('sha256').update(text.toLowerCase()).digest('hex');
}

module.exports = { encrypt, decrypt, hash };
