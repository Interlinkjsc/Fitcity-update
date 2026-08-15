/**
 * Rp 15/8 (158.xlsx v2, QA1 [HIGH]) — ATOMIC RESERVATION cho import khách hàng.
 * Vấn đề: users.phoneHash KHÔNG unique (prod có 17 nhóm trùng legacy → không thể tạo unique index thẳng),
 * nên "findOne rồi create" trong import không atomic: 2 upload đồng thời cùng SĐT có thể tạo 2 khách.
 * Giải pháp: mỗi dòng import phải "đặt chỗ" phoneHash trong collection này (UNIQUE) trước khi tạo user.
 * Request thứ 2 đụng E11000 → báo trùng. Reservation giữ lại vĩnh viễn (dấu vết ai import lúc nào);
 * nếu tạo user thất bại thì xoá reservation để không khoá nhầm SĐT.
 */
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    phoneHash: { type: String, required: true, unique: true, index: true },
    createdUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.models.ClientImportReservation
    || mongoose.model('ClientImportReservation', schema);
