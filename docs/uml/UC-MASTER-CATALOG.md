# FitCity FMS — Master Use Case Catalog

Bảng đầy đủ: **UC ID** | Tên | Actor chính | Route | Permission (resource.action)

---

## Public & Auth

| UC ID | Tên | Actor | Route |
|-------|-----|-------|-------|
| UC-G01 | Xem landing | Guest | `GET /` |
| UC-G02 | Đăng ký lead | Guest | `POST /register-lead` |
| UC-G03 | Trang liên hệ | Guest | `GET /contact`, `POST /register-lead` |
| UC-G04 | Danh sách blog | Guest | `GET /blog` |
| UC-G05 | Chi tiết blog | Guest | `GET /blog/:slug` |
| UC-A01 | Đăng nhập | All | `GET/POST /auth/login` |
| UC-A02 | Đăng ký Client | Guest | `POST /auth/register` |
| UC-A03 | Xem/sửa profile | Client, Staff | `GET/POST /auth/profile` |
| UC-A04 | Đổi mật khẩu | All | `POST /auth/change-password` |
| UC-A05 | Đăng xuất | All | `GET/POST /auth/logout` |

---

## CRM — Leads

| UC ID | Tên | Actor | Route | Permission |
|-------|-----|-------|-------|------------|
| UC-CRM10 | Danh sách leads | MKT, MGR, ADM | `GET /admin/leads` | leads.view |
| UC-CRM11 | Phễu chuyển đổi | MKT, MGR | (widget trên list) | leads.view |
| UC-CRM12 | Cập nhật trạng thái | MKT, MGR | `POST /admin/leads/detail/:id/status` | leads.manage |
| UC-CRM13 | Export Excel | MKT, MGR | `GET /admin/leads/export` | leads.view |
| UC-CRM14 | Chi tiết lead | MKT, MGR | `GET /admin/leads/detail/:id` | leads.view |
| UC-CRM15 | **Convert Lead → Client** | Sales, MKT, MGR, SA | `POST /admin/leads/detail/:id/convert` *(planned)* | leads.manage |
| UC-CRM16 | **Chặn Lead trùng email Client** | System | hook trong `registerLead` *(planned)* | — |

**Trạng thái Lead (mục tiêu R3):** `F` → `Contacted` → `Qualified` | `Lost` | `Converted` — không dùng `Signed` = đã ký HĐ.

**Bốn đường vào Client:** A `POST /register-lead`, B CRM status, C `POST /admin/clients/store`, D `POST /auth/register`. Chi tiết: `activity/act-11-client-contract-lifecycle.puml`.

## CRM — CMS & Content

| UC ID | Tên | Actor | Route | Permission |
|-------|-----|-------|-------|------------|
| UC-CRM20 | DS CMS | MKT, ADM | `GET /admin/cms` | cms.view |
| UC-CRM21 | Tạo CMS | MKT, ADM | `GET/POST /admin/cms/create, /store` | cms.manage |
| UC-CRM22 | Sửa/xóa CMS | MKT, ADM | `GET/POST /admin/cms/edit/:id` | cms.manage |
| UC-CRM30 | Kho nội dung | MKT | `GET /admin/content-library` | content_library.view |
| UC-CRM31 | Upload media | MKT | `POST /admin/content-library/store` | content_library.manage |

## CRM — Branches & Violations

| UC ID | Tên | Actor | Route | Permission |
|-------|-----|-------|-------|------------|
| UC-CRM40 | DS chi nhánh | CEO, MGR, ADM | `GET /admin/branches/list` | branch_dashboard.view |
| UC-CRM41 | CRUD chi nhánh | ADM, SA | `/admin/branches/*` | user_management.* |
| UC-CRM42 | Dashboard CN | CEO, MGR | `GET /admin/branches/detail/:id` | branch_dashboard.view |
| UC-CRM50 | Kỷ luật CRUD | MGR, ADM, CEO | `/admin/violations/*` | violations.* |

---

## Contracts

| UC ID | Tên | Actor | Route | Permission |
|-------|-----|-------|-------|------------|
| UC-CTR01 | DS HĐ | scope | `GET /admin/contracts/list` | contract.view |
| UC-CTR02 | Tạo HĐ | PT, Sales, ADM | `GET/POST .../create, /store` | contract.create |
| UC-CTR03 | Chi tiết HĐ | scope | `GET /admin/contracts/detail/:id` | contract.view |
| UC-CTR04 | Sửa HĐ | ADM, ACC, MGR | `GET/POST .../edit, /update` | contract.manage |
| UC-CTR05 | Xóa HĐ | ADM | `POST .../delete/:id` | contract.delete |
| UC-CTR06 | Tải PDF HĐ | scope | `GET .../download/:id` | contract.view |
| UC-CTR07 | Preview HĐ | scope | `GET .../:id/preview/contract` | contract.view |
| UC-CTR08 | Ghi thanh toán | ACC, ADM | `POST .../:id/payments/store` | contract.manage |
| UC-CTR09 | Preview phiếu thu | scope | `GET .../preview/receipt/:txId` | contract.view |
| UC-CTR10 | Bảo lưu HĐ | ADM, ACC | `POST .../pause/:id` | contract.manage |
| UC-CTR11 | Kích hoạt lại | ADM, ACC | `POST .../unpause/:id` | contract.manage |
| UC-CTR12 | DS yêu cầu bảo lưu | MGR, ADM | `GET .../requests` | contract.manage |
| UC-CTR13 | Duyệt/từ chối bảo lưu | MGR, ADM | `POST .../requests/approve\|reject` | contract.manage |
| UC-CTR14 | PT tạo HĐ | PT | `GET/POST /pt/contracts/*` | contract.create |
| UC-CTR30 | Affiliate F1 reward | System | (hook on Paid) | — |

---

## Clients — Portal

| UC ID | Tên | Actor | Route |
|-------|-----|-------|-------|
| UC-CLI01 | Dashboard | Client | `GET /client` |
| UC-CLI02 | Xác nhận buổi | Client | `POST /client/sessions/confirm/:id` |
| UC-CLI03 | Feedback CSAT | Client | `POST /client/sessions/:id/feedback` |
| UC-CLI04 | QR buổi | Client | `GET /client/sessions/:id/qr` |
| UC-CLI05 | Lịch PT | Client | `GET /client/schedule` |
| UC-CLI06 | Yêu cầu hủy lịch (trước khi bắt đầu) | Client | `POST /api/calendar/sessions/:id/request-cancel` |
| UC-CLI08 | Workouts | Client | `GET /client/workouts` |
| UC-CLI09 | Rewards | Client | `GET /client/rewards` |
| UC-CLI10 | Meal log | Client | `POST /client/meal-log` |
| UC-CLI11 | Nutrition | Client | `GET /client/nutrition` |
| UC-CLI12 | Progress | Client | `GET /client/progress` |
| UC-CLI13 | Notifications | Client | `GET /client/notifications` |
| UC-CLI14 | Đánh dấu đã đọc | Client | `POST /client/notifications/:id/read` |
| UC-CLI15 | DS HĐ của tôi | Client | `GET /client/contracts` |
| UC-CLI16 | Preview HĐ/phiếu thu | Client | `GET /client/contracts/:id/preview` |
| UC-CLI17 | Xin bảo lưu | Client | `POST /client/contracts/pause` |
| UC-CLI18 | Yêu cầu đổi PT | Client | `POST /client/pt-change-request` |
| UC-CLI19 | Affiliate profile | Client | `GET /auth/profile` |

## Clients — Admin

| UC ID | Tên | Actor | Route | Permission |
|-------|-----|-------|-------|------------|
| UC-CLI20 | DS KH admin | ADM, MGR | `GET /admin/clients/list` | staff_management.view |
| UC-CLI21 | Tạo/sửa KH (Staff) | ADM, MGR, SA | `POST /admin/clients/store` | staff_management.* |
| UC-CLI22 | Chi tiết KH | ADM, MGR | `GET /admin/clients/detail/:id` | staff_management.view |

| UC-SA-BYP01 | Tạo KH bỏ qua Lead | SA | *(cùng UC-CLI21)* | SA bypass RBAC |
| UC-SA-OVR01 | Force check-in buổi tập | SA | *(planned)* | — |
| UC-SA-OVR02 | Force confirm buổi tập | SA | *(planned)* | — |

**Contract status (code):** `Draft`, `Active`, `Expired`, `Paused`, `Cancelled`, `Liquidated` — không có `Terminated`.

---

## PT Operations

| UC ID | Tên | Actor | Route |
|-------|-----|-------|-------|
| UC-PT01 | Dashboard PT | PT | `GET /pt` |
| UC-PT02 | DS KH của PT | PT | `GET /pt/clients` |
| UC-PT03 | Lịch PT | PT | `GET /pt/schedule` |
| UC-PT04 | Thu nhập | PT | `GET /pt/income` |
| UC-PT05 | Quét QR (Check-in) | PT | `POST /pt/sessions/scan-qr` |
| UC-PT06 | Checkout buổi (Check-out) | PT | `POST /pt/sessions/check-out/:id` |
| UC-PT07 | Tạo hợp đồng | PT | `GET/POST /pt/contracts/*` |
| UC-PT08 | Chấm công vào | PT | `POST /pt/attendance/check-in` |
| UC-PT09 | Chấm công ra | PT | `POST /pt/attendance/check-out` |
| UC-PT10 | Daily report | PT | `GET/POST /pt/daily-report` |
| UC-PT11 | Xin nghỉ | PT | `GET/POST /pt/leave` |
| UC-PT12 | Đặt lịch tập | PT | `POST /pt/slots` |
| UC-PT13 | Xử lý yêu cầu hủy (Accept / Reject) | PT | `POST /pt/sessions/:id/accept-cancel`, `POST /pt/sessions/:id/reject-cancel` |
| UC-PT17 | Sửa meal plan | PT | `GET/POST /pt/meal-plan/:id/*` |
| UC-PT18 | Gán workout | PT | `GET/POST /pt/workout-assignments` |
| UC-PT20 | Metrics KH | PT | `/pt/metrics/*` |
| UC-PT30 | Duyệt timesheet | MGR | `/admin/timesheets/*` |
| UC-PT31 | Duyệt PT leave | MGR | `/admin/pt-leave-requests/*` |
| UC-PT32 | Duyệt đổi PT | MGR | `/admin/pt-change-requests/*` |
| UC-PT40 | Lịch slot admin | MGR | `/admin/slots/*` |

---

## Finance

| UC ID | Tên | Actor | Route | Permission |
|-------|-----|-------|-------|------------|
| UC-FIN01 | Bảng lương | ACC, ADM | `GET /admin/payroll` | payroll.view |
| UC-FIN02 | Export CSV lương | ACC | `GET /admin/payroll/export-csv` | payroll.view |
| UC-FIN03 | Duyệt lương | ADM | `POST /admin/payroll/approve` | payroll.manage |
| UC-FIN04 | Auto suggest | ADM | `POST /admin/payroll/auto-suggest` | payroll.manage |
| UC-FIN05 | Mark paid payroll | ADM | `POST /admin/payroll/mark-paid/:id` | payroll.manage |
| UC-FIN10 | Sổ chi | ACC, MGR | `GET /admin/expenses` | expenses.view |
| UC-FIN11 | Tạo chi + VAT | MGR, ADM | `POST /admin/expenses/store` | expenses.manage |
| UC-FIN12 | Chi tiết chi | ACC | `GET /admin/expenses/detail/:id` | expenses.view |
| UC-FIN13 | Export chi quý | CEO, ACC | `GET /admin/expenses/export` | expenses.view |
| UC-FIN20 | Coupons CRUD | Sales, ADM | `/admin/coupons/*` | coupons.* |
| UC-FIN21 | Gán reward | ADM | `POST /admin/coupons/assign-reward` | coupons.manage |
| UC-FIN30 | Rewards admin | ADM | `/admin/rewards/*` | rewards.* |

---

## Programs

| UC ID | Tên | Actor | Route | Permission |
|-------|-----|-------|-------|------------|
| UC-PRG01 | Packages CRUD | ADM | `/admin/packages/*` | packages.* |
| UC-PRG10 | Meal plans PT | PT | `/pt/meal-plans/*` | meal_plan.* |
| UC-PRG20 | Body metrics | PT | `/pt/metrics/*` | pt_session.* |
| UC-PRG30 | Workout assign | PT | `/pt/workout-assignments` | meal_plan.* |
| UC-PRG40 | KPI setup | CEO, ADM | `GET/POST /admin/kpi` | kpi.* |
| UC-PRG41 | KPI cá nhân | ADM | `POST /admin/users/detail/:id/kpi-target` | kpi.manage |

---

## Platform

| UC ID | Tên | Actor | Route | Permission |
|-------|-----|-------|-------|------------|
| UC-PLT01 | Admin dashboard | Staff | `GET /admin` | dashboard.view |
| UC-PLT10 | Settings | CEO, ADM | `GET/POST /admin/settings` | system_settings.* |
| UC-PLT20 | Checklist | CEO, MGR | `/admin/checklists/*` | checklist.* |
| UC-PLT30 | Daily reports | PT,Sales,MGR | `/admin/daily-reports/submit` | daily_report.submit |
| UC-PLT31 | Duyệt daily report | MGR | `/admin/daily-reports` | daily_report.manage |
| UC-PLT40 | Export tài chính | CEO | `GET /admin/export-report` | export_report.view |
| UC-PLT41 | Work report Excel | CEO, MGR | `GET /admin/export-work-report` | — |
| UC-PLT50 | Job descriptions | ADM | `/admin/job-descriptions/*` | job_description.* |
| UC-PLT70 | Phân quyền SA | SA | `/admin/permissions/*` | role_permissions.manage |

---

## Users

| UC ID | Tên | Actor | Route | Permission |
|-------|-----|-------|-------|------------|
| UC-USR01 | DS nhân sự | ADM, MGR | `GET /admin/users/list` | staff_management.view |
| UC-USR02 | CRUD user | ADM, MGR | `/admin/users/*` | staff_management.* |
| UC-USR03 | API role permissions | ADM | `GET /admin/users/api/role-permissions` | staff_management.view |
| UC-USR04 | Branch dashboard user | CEO | `GET /admin/users/dashboard/branch/:id` | branch_dashboard.view |

---

## API

| UC ID | Tên | Actor | Route |
|-------|-----|-------|-------|
| UC-API01 | Calendar sessions | PT, Client | `GET /api/calendar/sessions` |
| UC-API02 | Request Cancel / Process Cancel | PT, Client | `/api/calendar/sessions/:id/request-cancel`, `/pt/sessions/:id/accept-cancel` |
| UC-API03 | Scan QR API | PT | `POST /api/calendar/sessions/:id/scan-qr` |

---

*Tổng: ~120 use cases. Sơ đồ PlantUML: `docs/uml/use-cases/`, `sequence/`, `activity/`.*
