/**
 * Mẫu module feature — copy cả thư mục `_template` thành `src/modules/<ten-feature>`,
 * đổi tên export, thêm controllers/services/routes, rồi đăng ký router trong `src/core/httpMount.js`.
 */
const { defineModule } = require('../../core/moduleKit');

module.exports = defineModule({
    controllers: {},
    models: {},
    services: {},
    routes: {}
});
