# Feature modules (`src/modules`)

## Mục tiêu

- Mỗi **feature** = một thư mục: `controllers/`, `models/` (tuỳ chọn), `services/` (tuỳ chọn), `routes/`, `index.js`, `routes.js` (barrel export router).
- **Không còn shim** `controllers` / `services` / `models` / `routes` ở `src/` — mọi `require` trỏ thẳng `src/modules/...` (đã chạy `node scripts/unshim-imports.js` và xóa thư mục shim).
- **Lõi tái sử dụng** tại `src/core/` (xem dưới).

## Tạo feature mới (checklist)

1. Copy `src/modules/_template` → `src/modules/<ten-feature>`.
2. Thêm controller + route file trong feature; cập nhật `index.js` và `routes.js`.
3. Mở `src/core/httpMount.js`, thêm một dòng `app.use('<prefix>', ...Routes)` đúng thứ tự (route `/` để cuối nếu có).
4. Không cần shim route: đăng ký trực tiếp trong `src/core/httpMount.js`.

## `src/core` — bộ kit tái sử dụng

| File | Vai trò |
|------|--------|
| `AppError.js` | Lỗi nghiệp vụ + `statusCode`; `errorHandler` map ra HTTP. |
| `asyncHandler.js` | Bọc `async (req,res,next)` → `catch(next)`. |
| `moduleKit.js` | `defineModule({...})` — export thống nhất `{ controllers, models, services, routes }`. |
| `httpMount.js` | `mountFeatureRouters`, `mountDashboardRoutes` — gắn router tập trung. |
| `index.js` | Re-export toàn bộ API trên. |

Ví dụ trong service:

```js
const { AppError } = require('../../core/AppError');
if (!row) throw new AppError('Not found', 404);
```

Ví dụ controller async (API):

```js
const { asyncHandler } = require('../../core/asyncHandler');
exports.getOne = asyncHandler(async (req, res) => { /* ... */ });
```

## Hợp đồng `index.js`

Nên export đủ bốn khóa (có thể rỗng `{}`), dùng `defineModule` cho module mới:

```js
const { defineModule } = require('../../core/moduleKit');
module.exports = defineModule({
  controllers: { myController: require('./controllers/myController') },
  routes: { myRoutes: require('./routes/myRoutes') }
});
```

## Import — quy ước

- Model / service / controller: `require` tương đối tới file thật trong `src/modules/<feature>/...` (hoặc `../../other-feature/models/...` khi cross-module).
- Test / script: dùng đường dẫn tới `src/modules/...` (ví dụ `require('../../src/modules/users/models/userModel.js')`).
- Script migrate từ shim cũ (giữ lại để tham khảo): `scripts/unshim-imports.js`.
