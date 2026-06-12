# UI Screenshots — Client, PT & Admin

**Cập nhật:** 2026-05-17 (E2E faker seed + Admin SA)  
**Server:** `http://localhost:4000`

| Role | Email | Password |
|------|-------|----------|
| Client | `e2e.client@fitcity.com` | `123456` |
| PT | `e2e.pt@fitcity.com` | `123456` |
| Admin (SA) | `admin@fitcity.com` | `123456` |

## Chuẩn bị & chụp lại

```powershell
npm run seed:e2e:faker
npm run seed:admin          # tạo SA admin@fitcity.com nếu chưa có
node src/server.js
npm run capture:ui          # client + pt + admin
npm run capture:ui:admin         # admin desktop + mobile
npm run capture:ui:admin:mobile  # chỉ admin mobile
npm run capture:ui:admin:extras  # seed lead + CMS rồi chụp 30, 37
```

> **Lưu ý:** file `*.png` nằm trong `.gitignore` — chỉ có trên máy local tại `docs/screenshots/ui-capture/`.

## Viewport

| Loại | Kích thước |
|------|------------|
| Desktop | 1440 × 900 |
| Mobile | iPhone 13 (390 × 844) |

## Cấu trúc

```
ui-capture/
├── client/desktop|mobile/
├── pt/desktop|mobile/
├── admin/desktop|mobile/      — 37 PNG mỗi bên (đã chụp, gồm lead-detail + cms-edit)
└── extras/
```

### Client (9)

| File | Route |
|------|-------|
| `01-dashboard` | `/client` |
| `02-nutrition` | `/client/nutrition` |
| `03-schedule` | `/client/schedule` |
| `04-workouts` | `/client/workouts` |
| `05-progress` | `/client/progress?days=30` |
| `06-rewards` | `/client/rewards` |
| `07-contracts` | `/client/contracts` |
| `08-profile` | `/auth/profile` |
| `09-session-qr` | `/client/sessions/:id/qr` (tự động từ DB) |

### PT (17)

| File | Route |
|------|-------|
| `01-dashboard` | `/pt` |
| `02-clients` | `/pt/clients` |
| `03-schedule` | `/pt/schedule` |
| `04-income` | `/pt/income` |
| `05-attendance` | `/pt/attendance` |
| `06-daily-report` | `/pt/daily-report` |
| `07-leave` | `/pt/leave` |
| `08-slots` | `/pt/slots` |
| `09-requests` | `/pt/requests` |
| `10-meal-plans` | `/pt/meal-plans` |
| `11-meal-plans-create` | `/pt/meal-plans/create` |
| `12-workout-assignments` | `/pt/workout-assignments` |
| `13-metrics` | `/pt/metrics` |
| `14-contracts-create` | `/pt/contracts/create` |
| `15-meal-plan-detail` | `/pt/meal-plans/:id` |
| `16-metrics-add` | `/pt/metrics/add/:clientId` |
| `17-metrics-history` | `/pt/metrics/history/:clientId` |

### Admin (37 màn / viewport)

| File | Route |
|------|-------|
| `01-dashboard` | `/admin` |
| `02-leads` | `/admin/leads` |
| `03-contracts` | `/admin/contracts/list` |
| `04-contracts-create` | `/admin/contracts/create` |
| `05-contracts-pause-requests` | `/admin/contracts/requests` |
| `06-clients` | `/admin/clients/list` |
| `07-users` | `/admin/users/list` |
| `08-packages` | `/admin/packages/list` |
| `09-payroll` | `/admin/payroll` |
| `10-expenses` | `/admin/expenses` |
| `11-coupons` | `/admin/coupons` |
| `12-rewards` | `/admin/rewards` |
| `13-cms` | `/admin/cms` |
| `14-cms-create` | `/admin/cms/create` |
| `15-content-library` | `/admin/content-library` |
| `16-branches` | `/admin/branches/list` |
| `17-violations` | `/admin/violations` |
| `18-settings` | `/admin/settings` |
| `19-checklists` | `/admin/checklists` |
| `20-daily-reports` | `/admin/daily-reports` |
| `22-job-descriptions` | `/admin/job-descriptions` |
| `23-permissions` | `/admin/permissions` |
| `24-kpi` | `/admin/kpi` |
| `25-timesheets` | `/admin/timesheets` |
| `26-pt-leave` | `/admin/pt-leave-requests` |
| `27-pt-change-requests` | `/admin/pt-change-requests` |
| `28-slots` | `/admin/slots` |
| `29-slots-requests` | `/admin/slots/requests` |
| `30-lead-detail` | `/admin/leads/detail/:id` |
| `31-contract-detail` | `/admin/contracts/detail/:id` |
| `32-client-detail` | `/admin/clients/detail/:id` |
| `33-user-detail` | `/admin/users/detail/:id` |
| `34-package-detail` | `/admin/packages/detail/:id` |
| `35-expense-detail` | `/admin/expenses/detail/:id` |
| `36-branch-detail` | `/admin/branches/detail/:id` |
| `37-cms-edit` | `/admin/cms/edit/:id` |

Seed lead/CMS cho 2 màn trên: `npm run seed:ui-capture-extras`

## Sửa lỗi đã áp dụng

- **`/pt/income` 500:** gọi sai tham số `generateBiMonthlyPayroll(staff, month, year)` → đã sửa dùng `resolvePTPayrollCommission` + commission.
- **`/pt/contracts/create` 500:** decrypt `email` khi render EJS → query `.select('name phone')` + không dùng email trong view.
- **Seed E2E:** thêm `packageSnapshot` cho Contract trong `e2e_faker_seed.js`.
- **Admin lists 500:** `decrypt()` trả `null` khi key lệch; coupons/clients/users list OK.
- **Admin `users/detail`:** sửa EJS thừa `<% } %>`.
