# FITCITY — Quy tắc nghiệp vụ & ma trận quyền (Phase 0)

Tài liệu tham chiếu cho dev/test. Cập nhật: 2026-05-17.

## Quy tắc hợp đồng & giá

| Khái niệm | Quy tắc |
|-----------|---------|
| `ServicePackage.price` | Giá **một buổi** (VNĐ/buổi) |
| `durationMonths` | Thời hạn gói/HĐ tính bằng **tháng** (`duration` ngày = tháng × 30, legacy) |
| `basePrice` | `unitPrice × sessions` (tổng buổi HĐ) |
| `netAmount` | `basePrice - discount` (trước VAT) — **dùng cho KPI doanh thu** |
| `totalAmount` | Sau VAT |
| `ptCommission` | `% × netAmount` (mặc định 10%) |

## Phạm vi hợp đồng theo vai trò

| Vai trò | Hợp đồng thấy được |
|---------|-------------------|
| SA, Admin, CEO, Accountant | Toàn hệ thống (lọc `branchId` tùy chọn) |
| Manager | `branch = CN mình` **HOẶC** `sales = mình` **HOẶC** `pt = mình` |
| Sales | `sales = mình` |
| PT | `pt = mình` hoặc `sales = mình` |
| Client | `client = mình` |

## Ma trận quyền (tóm tắt)

| Module | view | create | manage | delete |
|--------|------|--------|--------|--------|
| Dashboard `/admin` | Admin, Manager, SA, CEO, Accountant, Sales, Marketing | — | — | — |
| contract | Admin, CEO, Manager, Accountant, Sales, PT, Client | PT, Sales, Admin, Manager | Admin, Accountant, Manager | Admin |
| payroll | Admin, SA, Accountant | — | Admin, SA | — |
| staff_management | Admin, Manager | Admin, Manager | Admin | Admin |
| user_management (branches) | Admin, SA, CEO | Admin, SA | Admin, SA | Admin, SA |
| system_settings | Admin | — | Admin | — |
| branch_dashboard | CEO, Manager, Admin, SA | — | — | — |
| kpi setup `/admin/kpi` | SA, Admin, CEO | SA, Admin, CEO | — | — |
| expenses | SA, Admin, Manager, Accountant | — | — | SA, Admin |
| leads | Admin, Manager, SA, Marketing | — | — | — |

**Lưu ý:** Module không khai báo trong registry → **từ chối** (fail-closed).

## Quản lý phân quyền (SA)

- URL: `/admin/permissions` (chỉ role **SA**).
- Danh mục đầy đủ: `src/core/permissionsRegistry.js`.
- Lưu DB: collection `rolepermissions` (override theo role).
- Nút **Gợi ý theo role**: tick các quyền có `suggestedRoles` chứa role đang chọn.
- Mặc định (chưa lưu DB): dùng gợi ý từ registry.

## Tạo / sửa tài khoản nhân sự

- Form `/admin/users/create` và `/edit`: khi chọn **Vai trò**, panel **Quyền hạn khi đăng nhập** tự tải (API `GET /admin/users/api/role-permissions?role=...`).
- Mặc định: quyền = quyền của **role** (registry + override DB tại `/admin/permissions`).
- **Quyền riêng từng user** (Admin/SA): bật *Quyền riêng cho tài khoản này*, tick `customPermissionIds` — khi đăng nhập dùng bộ này thay role (`useCustomPermissions` trên `User` + session).
- Admin chỉ cấp được quyền nằm trong quyền hiệu lực của chính Admin; SA không giới hạn.
- Role **SA** không dùng custom per-user (luôn toàn quyền).
- SA thấy link **Chỉnh quyền role** → `/admin/permissions`.
- Manager không thể gán Admin/SA/CEO; Admin không gán SA.

## CEO

- Đăng nhập → `/admin` dashboard (xem toàn hệ thống).
- KPI setup: được (cùng Admin/SA).
- **Cài đặt hệ thống** (`/admin/settings`): VAT mặc định, % HH PT mặc định (cùng Admin).
- **Checklist công việc** (`/admin/checklists`): tạo/giao/ theo dõi task (cùng Manager).

## Checklist & chất lượng dịch vụ

- Checklist: roles SA, Admin, CEO, Manager — permissions `checklist.view`, `checklist.manage`.
- Client đánh giá PT: `POST /client/sessions/:id/feedback` (1–5 sao) sau buổi `Completed` đã xác nhận.
- Dashboard admin: widget CSAT (% buổi có rating, điểm TB, top PT).

## Job Description (JD)

- Admin quản lý mẫu: `/admin/job-descriptions`.
- Form tạo user: chọn `jobDescriptionTemplateId` → copy `items` vào `user.jobDescription`.

## Cài đặt hệ thống

- Collection `SystemSettings` key `global`: `defaultVat`, `defaultPtCommissionRate`, `ptPayrollMode`, `timesheetRatePerShift`.
- Hợp đồng **mới** dùng VAT từ settings; HĐ cũ không đổi retroactive.
- `ptPayrollMode`: `contract` | `timesheet` | `hybrid` — cách tính hoa hồng PT trên `/admin/payroll`.

## Chấm công (Timesheet)

- **QR buổi khách** (`/pt/sessions/scan-qr`): ghi nhận buổi dạy với client.
- **Timesheet** (`/pt/attendance`): check-in/out **ca dạy** tại chi nhánh; Manager duyệt tại `/admin/timesheets`.
- Permissions: `timesheet.view`, `timesheet.manage`.
- Payroll PT: `contract` = HH trên HĐ Paid; `timesheet` = số ca Approved × `timesheetRatePerShift`; `hybrid` = trung bình hai nguồn.

## KPI

- Target chi nhánh: `KPIConfig.revenueTarget`, `contractTarget`, `newLeadTarget` theo chi nhánh/tháng.
- **Chỉ tiêu cá nhân (PT/Sales):** collection `EmployeeKPITarget` (staff + month + year). Nếu có bản ghi → `targetSource: employee` và dùng số trên form; không có → fallback chi nhánh (`branch`) hoặc `none`.
- Gán chỉ tiêu: `/admin/users/detail/:id` → form **Lưu chỉ tiêu cá nhân** (quyền `kpi.manage`). POST `/admin/users/detail/:id/kpi-target`.
- PT: thêm `sessionTarget` (buổi mục tiêu). Sales: `revenueTarget`, `contractTarget`, `newLeadTarget`.
- Actual doanh thu: `sum(netAmount)` hợp đồng không `Cancelled`, cùng bộ lọc ngày/chi nhánh.

## Payroll (hoa hồng)

- **Cấu hình trên hồ sơ nhân viên** (`/admin/users/create`, `/admin/users/edit`): PT → `ptCommissionRate` (%); Sales/Manager → `salesCommissionRate` (%). Cơ sở tính: **netAmount** (giá trị HĐ trước VAT).
- **Sales/Manager:** payroll = `% × tổng netAmount` các HĐ `Paid` trong tháng (rate từ `salesCommissionRate`, mặc định 5%).
- **PT:** lúc tạo HĐ, `ptCommission = netAmount × ptCommissionRate/100` (rate lấy từ profile PT, mặc định 10%); payroll = tổng `ptCommission` trên HĐ `Paid` trong tháng.

## Phạm vi truy cập HĐ (chi tiết)

- `canAccessContract` áp dụng: xem chi tiết, sửa, xóa, tải PDF, preview, thanh toán, bảo lưu/kích hoạt, duyệt/từ chối yêu cầu bảo lưu.
- Danh sách yêu cầu bảo lưu (`/admin/contracts/requests`) chỉ hiện HĐ trong phạm vi user (cùng rule list HĐ).

## Chi phí nội bộ (Sprint 3)

- Form `/admin/expenses`: `amountBeforeVat`, `vatRate`, tự tính `vatAmount` + `total`; loại chứng từ `taxDocumentType`.
- Upload chứng từ → Google Drive (mock nếu không có credentials); field `googleDriveFileId`.
- Dashboard: tổng trước VAT / VAT / theo loại chứng từ; export Excel (`/admin/expenses/export`, lọc quý).
- Migration dữ liệu cũ: `node scripts/migrate-expense-vat.js`.

## Daily Report & PT nghỉ

- **Daily Report:** PT/Sales nộp 1 báo cáo/ngày; Manager duyệt tại `/admin/daily-reports`.
- **Xuất báo cáo công việc:** `/admin/export-work-report?month=&year=` (CEO/Manager) — gồm Checklist + Daily Report.
- **PT nghỉ giữa kỳ:** PT gửi tại `/pt/leave`; Manager chọn PT thay thế → cập nhật `pt` trên HĐ `Active`/`Draft`.

## Hợp đồng — nguồn thu

- Field `revenueSource`: `PT_Contract` | `Gym_Subscription` | `Other` (tự suy ra hoặc chọn trên form tạo HĐ).

## CRM & Marketing (Sprint 5)

- **Lead:** nguồn `Website` | `Contact` | `Facebook` | `Referral` | `Walk-in`; metrics thể trạng trên landing.
- **Noti:** lead mới → Marketing/Manager/Admin (in-app).
- **CMS:** `/admin/cms` — `SiteContent` (banner, post, seo, section); public `/blog`, hero từ banner published.
- **Kho nội dung:** `/admin/content-library` — `ContentAsset` + upload local/Drive.
- **Contact:** `/contact` → `POST /register-lead` với `source=Contact`.
- **Phễu:** widget trên `/admin/leads`; cập nhật trạng thái tại chi tiết lead.
- **Permissions:** `cms.*`, `content_library.*` (reset SA tại `/admin/permissions` nếu cần).

## Client app (Sprint 6)

- **Nhật ký bữa ăn:** Client ghi tại `/client/nutrition` (Breakfast/Lunch/Dinner/Snack).
- **Affiliate:** `referralCode` tự sinh; đăng ký có thể nhập mã → `referredBy`; F1 HĐ `Paid` → Reward Gift 200k cho referrer (1 lần/HĐ).
- **Lộ trình tuần:** PT gán tại `/pt/workout-assignments`; Client xem tại `/client/workouts`.
- **Tiến độ:** `/client/progress?days=30|60|90`.
- **UAT:** `docs/uat-sprint6.md`.

## Dữ liệu cũ (migration)

- Chạy một lần: `node scripts/migrate-duration-months.js` để gán `durationMonths` cho gói tập và snapshot HĐ cũ.
- Chi phí VAT: `node scripts/migrate-expense-vat.js`.
