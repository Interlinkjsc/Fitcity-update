const { decrypt } = require('./encryption');

// Các field được mã hóa ở userModel (set: encrypt / get: decrypt).
// Khi query dùng .lean(), getter KHÔNG chạy → giá trị vẫn là chuỗi "iv:cipher".
// Helper này giải mã tại chỗ để không lộ chuỗi mã hóa ra UI (class bug 1.10 / A10).
const ENCRYPTED_FIELDS = ['email', 'phone', 'cccdNumber'];

function looksEncrypted(v) {
    return typeof v === 'string' && /^[0-9a-f]{16,}:[0-9a-f]+$/i.test(v);
}

/** Giải mã in-place các field mã hóa trên 1 plain object (kết quả .lean()). */
function decryptPerson(person) {
    if (!person || typeof person !== 'object') return person;
    for (const field of ENCRYPTED_FIELDS) {
        if (looksEncrypted(person[field])) {
            try { person[field] = decrypt(person[field]); }
            catch (_) { person[field] = ''; }
        }
    }
    // emergencyContact.phone cũng có thể mã hóa
    if (person.emergencyContact && looksEncrypted(person.emergencyContact.phone)) {
        try { person.emergencyContact.phone = decrypt(person.emergencyContact.phone); }
        catch (_) { person.emergencyContact.phone = ''; }
    }
    return person;
}

/** Giải mã nhiều người (mảng) hoặc theo danh sách path lồng nhau. */
function decryptPeople(objs, paths = [null]) {
    const list = Array.isArray(objs) ? objs : [objs];
    for (const obj of list) {
        if (!obj) continue;
        for (const p of paths) {
            const target = p ? p.split('.').reduce((o, k) => (o ? o[k] : undefined), obj) : obj;
            decryptPerson(target);
        }
    }
    return objs;
}

module.exports = { decryptPerson, decryptPeople, looksEncrypted };
