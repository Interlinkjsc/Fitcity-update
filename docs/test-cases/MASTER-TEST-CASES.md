# Master Test Cases — FitCity FMS

**Phiên bản:** Sprint 0–6 | **Nguồn UML:** `docs/uml/`  
**Cột:** TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected result

---

## 1. Public & Auth (`01-public-auth`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-G01-01 | UC-G01 | ACT-01 | P0 | Manual | Server chạy | GET `/` | 200; hero/packages; nội dung CMS nếu có |
| TC-G01-02 | UC-G01 | — | P2 | Auto | — | GET `/` via supertest | 200 HTML |
| TC-G02-01 | UC-G02 | SEQ-01, ACT-01 | P0 | Manual | Branch tồn tại | POST `/register-lead` đủ field | Redirect success; Lead trong DB |
| TC-G02-02 | UC-G02 | SEQ-01 | P1 | Auto | MKT user seed | POST lead + assert notify | `leadNotifyService` pass |
| TC-G02-03 | UC-G02 | — | P1 | Manual | — | POST thiếu phone | 400/flash lỗi |
| TC-G03-01 | UC-G03 | ACT-01 | P1 | Manual | — | GET `/contact` → submit | Lead `source=Contact` |
| TC-G04-01 | UC-G04 | — | P1 | Manual | CMS blog published | GET `/blog` | Danh sách bài |
| TC-G05-01 | UC-G05 | — | P1 | Manual | Slug hợp lệ | GET `/blog/:slug` | 200 chi tiết |
| TC-G05-02 | UC-G05 | — | P2 | Manual | Slug sai | GET `/blog/invalid` | 404 |
| TC-A01-01 | UC-A01 | SEQ-09, ACT-02 | P0 | Auto | User Active | POST `/auth/login` Client | Redirect `/client` |
| TC-A01-02 | UC-A01 | SEQ-09 | P0 | Auto | — | Login PT / Manager / Admin | Redirect đúng portal |
| TC-A01-03 | UC-A01 | — | P1 | Manual | — | Sai password | Flash lỗi, không session |
| TC-A02-01 | UC-A02 | ACT-01 | P0 | Manual | Email chưa dùng | POST `/auth/register` | User Client Active |
| TC-A02-02 | UC-A02 | ACT-01 | P1 | Manual | Referrer có mã | Register + `referralCode` | `referredBy` = referrer |
| TC-A03-01 | UC-A03 | ACT-02 | P1 | Manual | Client login | GET/POST `/auth/profile` | Cập nhật name/phone |
| TC-A03-02 | UC-A03 | UC-CLI19 | P1 | Manual | Client có referralCode | Profile | Hiện mã + F1 count |
| TC-A04-01 | UC-A04 | — | P1 | Manual | Đã login | POST change-password | Đổi được; login mới OK |
| TC-A05-01 | UC-A05 | — | P1 | Manual | Đã login | GET `/auth/logout` | Session cleared |

---

## 2. CRM (`02-crm`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-CRM10-01 | UC-CRM10 | ACT-05 | P0 | Manual/E2E | MKT + `leads.view` | GET `/admin/leads` | 200; bảng leads |
| TC-CRM11-01 | UC-CRM11 | — | P1 | Auto | Leads nhiều status | Gọi funnel service | % đúng theo status |
| TC-CRM12-01 | UC-CRM12 | ACT-05 | P1 | Manual | Lead tồn tại | POST status → Contacted | DB + UI cập nhật |
| TC-CRM12-02 | UC-CRM12 | — | P1 | Manual | — | Chuỗi F→Contacted→Signed | Không skip trạng thái sai |
| TC-CRM13-01 | UC-CRM13 | — | P2 | Manual | Có leads | GET export | File Excel tải về |
| TC-CRM14-01 | UC-CRM14 | — | P1 | Manual | — | GET detail/:id | Chi tiết + lịch sử |
| TC-CRM20-01 | UC-CRM20 | ACT-05 | P1 | Manual | `cms.view` | GET `/admin/cms` | DS trang |
| TC-CRM21-01 | UC-CRM21 | — | P1 | Manual | `cms.manage` | Tạo trang blog/landing | Public reflect sau publish |
| TC-CRM22-01 | UC-CRM22 | — | P1 | Manual | — | Sửa + xóa CMS | CRUD OK |
| TC-CRM30-01 | UC-CRM30 | — | P1 | Manual | `content_library.view` | GET content-library | Grid media |
| TC-CRM31-01 | UC-CRM31 | — | P1 | Manual | — | Upload file local | Lưu DB + file disk |
| TC-CRM40-01 | UC-CRM40 | ACT-08 | P2 | Manual | CEO/MGR | GET branches list | 200 |
| TC-CRM42-01 | UC-CRM42 | — | P2 | Manual | — | Branch detail dashboard | KPI branch |
| TC-CRM50-01 | UC-CRM50 | — | P2 | Manual | `violations.*` | CRUD violation | Ghi nhận vi phạm |
| TC-SEQ01-01 | UC-G02 | SEQ-01 | P0 | Auto | — | Lead create → notify count | ≥1 Marketing noti |

---

## 3. Contracts (`03-contracts`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-CTR01-01 | UC-CTR01 | ACT-04 | P0 | Manual | Sales scope branch | GET contracts list | Chỉ HĐ scope |
| TC-CTR02-01 | UC-CTR02 | ACT-04 | P0 | Manual | Client, package, PT | Create → store Draft | HĐ Draft trong DB |
| TC-CTR03-01 | UC-CTR03 | — | P1 | Manual | — | GET detail/:id | Đủ thông tin + payments |
| TC-CTR04-01 | UC-CTR04 | — | P1 | Manual | ACC/MGR | Edit update | Fields lưu |
| TC-CTR05-01 | UC-CTR05 | — | P2 | Manual | Admin | Delete | Soft/hard theo rule |
| TC-CTR06-01 | UC-CTR06 | — | P1 | Manual | — | Download PDF | PDF hợp lệ |
| TC-CTR07-01 | UC-CTR07 | — | P2 | Manual | — | Preview contract | HTML/PDF preview |
| TC-CTR08-01 | UC-CTR08 | SEQ-03, ACT-07 | P0 | Manual/Auto | HĐ Draft | POST payment partial | paidAmount tăng; chưa Paid |
| TC-CTR08-02 | UC-CTR08 | SEQ-03 | P0 | Auto | — | Full payment | `paymentStatus=Paid`, Active |
| TC-CTR09-01 | UC-CTR09 | — | P2 | Manual | Có transaction | Preview receipt | Phiếu thu hiển thị |
| TC-CTR10-01 | UC-CTR10 | — | P1 | Manual | HĐ Active | POST pause | Status Paused |
| TC-CTR11-01 | UC-CTR11 | — | P1 | Manual | HĐ Paused | POST unpause | Active lại |
| TC-CTR12-01 | UC-CTR12 | — | P1 | Manual | Client gửi pause | Admin list requests | Pending hiển thị |
| TC-CTR13-01 | UC-CTR13 | — | P1 | Manual | — | Approve/reject pause | Status đúng |
| TC-CTR14-01 | UC-CTR14 | — | P1 | Manual | PT login | `/pt/contracts` create | PT tạo HĐ scope |
| TC-CTR30-01 | UC-CTR30 | SEQ-03 | P0 | Auto | B có referredBy=A | Paid HĐ B | A có Reward Gift |
| TC-CTR30-02 | UC-CTR30 | — | P1 | Auto | Đã reward 1 lần | Paid lần 2 | Không duplicate log |

---

## 4. Client Portal (`04-clients`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-CLI01-01 | UC-CLI01 | ACT-02 | P0 | Manual | Client Active + HĐ | GET `/client` | Dashboard widgets |
| TC-CLI02-01 | UC-CLI02 | SEQ-02 | P0 | Auto | Session completed | POST confirm | `clientConfirmed=true` |
| TC-CLI03-01 | UC-CLI03 | SEQ-02 | P1 | Manual | Sau buổi | POST feedback rating 1–5 | Lưu rating; CSAT aggregate |
| TC-CLI04-01 | UC-CLI04 | SEQ-02 | P1 | Manual | Session scheduled | GET qr?action=start | QR token valid |
| TC-CLI05-01 | UC-CLI05 | SEQ-04, ACT-02 | P0 | Manual | — | GET schedule | Slots available |
| TC-CLI06-01 | UC-CLI06 | SEQ-04 | P0 | Manual/Auto | Slot open | POST request | Pending; PT noti |
| TC-CLI07-01 | UC-CLI07 | — | P2 | Manual | Session booked | Reschedule request | Request tạo |
| TC-CLI08-01 | UC-CLI08 | ACT-02 | P1 | Manual | PT đã assign | GET workouts | Block lộ trình tuần |
| TC-CLI09-01 | UC-CLI09 | ACT-02 | P1 | Manual | Có rewards | GET rewards | List; Gift có icon hộp |
| TC-CLI10-01 | UC-CLI10 | SEQ-08 | P0 | Auto/Manual | Meal plan active | POST meal-log Sáng | Log hôm nay |
| TC-CLI10-02 | UC-CLI10 | — | P1 | Manual | Đã log Sáng | POST Sáng lại | Upsert 1 dòng |
| TC-CLI11-01 | UC-CLI11 | SEQ-08 | P1 | Manual | — | GET nutrition | Macro + meals |
| TC-CLI12-01 | UC-CLI12 | — | P1 | Manual | Có metrics | GET progress?days=30/60/90 | Chart đúng range |
| TC-CLI13-01 | UC-CLI13 | — | P2 | Manual | Có noti | GET notifications | List |
| TC-CLI14-01 | UC-CLI14 | — | P2 | Manual | — | POST read | Mark read |
| TC-CLI15-01 | UC-CLI15 | — | P1 | Manual | — | GET contracts | Chỉ HĐ của client |
| TC-CLI16-01 | UC-CLI16 | — | P2 | Manual | — | Preview contract/receipt | 200 |
| TC-CLI17-01 | UC-CLI17 | — | P1 | Manual | HĐ Active | POST pause request | Pending admin |
| TC-CLI18-01 | UC-CLI18 | — | P1 | Manual | — | POST pt-change-request | Manager duyệt flow |
| TC-CLI20-01 | UC-CLI20 | — | P1 | Manual | Admin | GET admin clients list | 200 |
| TC-CLI21-01 | UC-CLI21 | — | P1 | Manual | — | CRUD client admin | OK |
| TC-SEQ02-01 | UC-PT05 | SEQ-02 | P0 | Auto | PT+Client session | scan start → end → confirm | Status flow đúng |
| TC-SEQ04-01 | UC-CLI06 | SEQ-04 | P0 | Auto | — | `schedule_flow.test.js` | Approve tạo session |

---

## 5. PT Operations (`05-pt-operations`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-PT01-01 | UC-PT01 | ACT-03 | P1 | Manual | PT login | GET `/pt` | Dashboard |
| TC-PT02-01 | UC-PT02 | — | P1 | Manual | — | GET clients | DS KH của PT |
| TC-PT03-01 | UC-PT03 | — | P1 | Manual | — | GET schedule | Lịch tuần |
| TC-PT04-01 | UC-PT04 | — | P2 | Manual | Có HĐ Paid | GET income | Commission hiển thị |
| TC-PT05-01 | UC-PT05 | SEQ-02 | P0 | Auto | Valid QR token | POST scan-qr | In_Progress/Completed |
| TC-PT05-02 | UC-PT05 | — | P1 | Auto | Token hết hạn | scan-qr | 400/403 |
| TC-PT06-01 | UC-PT06 | — | P1 | Manual | — | POST check-out/:id | Session completed |
| TC-PT07-01 | UC-PT07 | SEQ-05, ACT-03 | P0 | Manual/Auto | — | check-in → check-out | Timesheet Pending |
| TC-PT08-01 | UC-PT08 | SEQ-06 | P1 | Manual/Auto | — | Submit daily report | 1 report/ngày/user |
| TC-PT09-01 | UC-PT09 | SEQ-07, ACT-03 | P1 | Auto | HĐ Active | POST leave + approve | PT HĐ reassigned |
| TC-PT10-01 | UC-PT10 | — | P1 | Manual | — | CRUD slots | Slot open/closed |
| TC-PT11-01 | UC-PT11 | SEQ-04 | P0 | Manual | Pending request | Approve slot | WorkoutSession tạo |
| TC-PT12-01 | UC-PT12 | SEQ-08 | P1 | Manual | — | Edit meal plan | Active plan đúng client |
| TC-PT13-01 | UC-PT13 | ACT-02 | P1 | Auto | — | Assign workout week | Client thấy assignment |
| TC-PT20-01 | UC-PT20 | — | P1 | Manual | — | POST body metric | Chart client progress |
| TC-PT30-01 | UC-PT30 | SEQ-05, ACT-06 | P0 | Manual/Auto | Timesheet pending | Approve | Approved |
| TC-PT31-01 | UC-PT31 | SEQ-07 | P1 | Auto | — | `ptLeaveService.test.js` | Reassign contracts |
| TC-PT32-01 | UC-PT32 | — | P1 | Manual | Client request | Manager approve đổi PT | HĐ đổi PT |
| TC-SEQ05-01 | UC-FIN01 | SEQ-05 | P0 | Auto | Approved timesheets | payroll calculate hybrid | Số liệu khớp mode |
| TC-SEQ06-01 | UC-PLT30 | SEQ-06 | P1 | Auto | — | dailyReportService | Submit/approve |
| TC-SEQ07-01 | UC-PT09 | SEQ-07 | P1 | Auto | — | leave approve | replacementPtId |

---

## 6. Finance (`06-finance`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-FIN01-01 | UC-FIN01 | SEQ-05, ACT-06 | P0 | Manual/Auto | Tháng có data | GET payroll | Rows PT + amount |
| TC-FIN02-01 | UC-FIN02 | — | P2 | Manual | — | export-csv | CSV tải về |
| TC-FIN03-01 | UC-FIN03 | — | P1 | Manual | Admin | approve payroll | Status approved |
| TC-FIN04-01 | UC-FIN04 | — | P2 | Manual | — | auto-suggest | Gợi ý từ timesheet/HĐ |
| TC-FIN05-01 | UC-FIN05 | — | P1 | Manual | — | mark-paid | Paid flag |
| TC-FIN10-01 | UC-FIN10 | ACT-06 | P1 | Manual | ACC/MGR scope | GET expenses | List + filter |
| TC-FIN11-01 | UC-FIN11 | — | P1 | Manual | — | POST expense + VAT% | VAT tính đúng |
| TC-FIN12-01 | UC-FIN12 | — | P2 | Manual | — | detail/:id | Chi tiết |
| TC-FIN13-01 | UC-FIN13 | — | P2 | Manual | CEO | export quý | Excel aggregate |
| TC-FIN20-01 | UC-FIN20 | — | P1 | Auto | — | coupon CRUD test | Pass |
| TC-FIN21-01 | UC-FIN21 | — | P1 | Manual | — | assign-reward | Client có reward |
| TC-FIN30-01 | UC-FIN30 | — | P2 | Manual | — | admin rewards | CRUD |

---

## 7. Programs (`07-programs`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-PRG01-01 | UC-PRG01 | — | P1 | Auto | Admin | packages CRUD | `package.test.js` |
| TC-PRG10-01 | UC-PRG10 | SEQ-08 | P1 | Manual | PT | Tạo meal plan → active | Deactivate plan cũ |
| TC-PRG10-02 | UC-PRG10 | — | P1 | Manual | — | GET `/pt/meal-plans/:id` | Detail macro (không stub) |
| TC-PRG20-01 | UC-PRG20 | — | P1 | Auto | — | body metric integration | Pass |
| TC-PRG30-01 | UC-PRG30 | — | P1 | Auto | — | workoutAssignmentService | Week assign |
| TC-PRG40-01 | UC-PRG40 | — | P2 | Manual | CEO | KPI setup | Targets lưu |
| TC-PRG41-01 | UC-PRG41 | — | P2 | Auto | — | employeeKpiTarget test | Pass |
| TC-SEQ08-01 | UC-CLI10 | SEQ-08 | P0 | Auto | — | mealLogService upsert | 1 log/mealType/day |

---

## 8. Platform (`08-platform`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-PLT01-01 | UC-PLT01 | ACT-06 | P0 | Manual | Staff login | GET `/admin` | Dashboard + CSAT |
| TC-PLT10-01 | UC-PLT10 | ACT-08 | P1 | Auto | Admin | settings VAT/commission | `systemSettingsService` |
| TC-PLT20-01 | UC-PLT20 | — | P1 | Manual | MGR | checklist CRUD | Tasks assign |
| TC-PLT30-01 | UC-PLT30 | SEQ-06 | P1 | Manual/Auto | PT/Sales | submit daily report | Saved |
| TC-PLT31-01 | UC-PLT31 | SEQ-06 | P1 | Manual | Manager | approve/reject | Status đúng |
| TC-PLT40-01 | UC-PLT40 | — | P2 | Manual | CEO | export-report | File tải |
| TC-PLT41-01 | UC-PLT41 | ACT-08 | P2 | Manual | — | export-work-report | Excel checklist+daily |
| TC-PLT50-01 | UC-PLT50 | — | P2 | Manual | — | job-descriptions CRUD | Gán user form |
| TC-PLT70-01 | UC-PLT70 | ACT-09, SEQ-09 | P1 | Auto | SA | permissions reset | `rbac.test.js` |

---

## 9. Users & Organization (`09-users`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-USR01-01 | UC-USR01 | — | P1 | Manual | MGR scope | users list | Chỉ branch scope |
| TC-USR02-01 | UC-USR02 | — | P1 | Auto | — | user CRUD integration | Pass |
| TC-USR03-01 | UC-USR03 | — | P2 | Manual | — | API role-permissions | JSON matrix |
| TC-USR04-01 | UC-USR04 | — | P2 | Manual | CEO | branch dashboard user | KPI |
| TC-SEQ09-01 | UC-A01 | SEQ-09 | P0 | Auto | Sales no permission | GET contract manage | 403 |
| TC-SEQ09-02 | UC-A01 | SEQ-09 | P1 | Auto | — | `contractScope.test.js` | Scope đúng role |

---

## 10. API & Health (`11-api-health`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-API01-01 | UC-API01 | — | P1 | Auto | Session login | GET calendar/sessions | JSON events |
| TC-API02-01 | UC-API02 | — | P1 | Manual | Session booked | PATCH cancel | Cancelled |
| TC-API03-01 | UC-API03 | — | P1 | Auto | — | POST scan-qr API | Same as web QR |
| TC-API00-01 | — | — | P2 | Manual | — | Health endpoint (nếu có) | 200 |

---

## 11. Cross-module E2E (`10-cross-module-flows`)

| TC-ID | UC | SEQ/ACT | P | Type | Preconditions | Steps | Expected |
|-------|-----|---------|---|------|---------------|-------|----------|
| TC-E2E-01 | Multi | ACT-01→05→04→07→02 | P0 | Manual | Seed đủ role | Guest lead → MKT → Sales HĐ → ACC Paid → Client book → PT QR → feedback | End-to-end không lỗi |
| TC-E2E-02 | UC-CTR30 | SEQ-03 | P0 | Manual | Referral chain | Register B→Paid→A rewards | Gift 200k/90d |
| TC-E2E-03 | UC-PT07 | SEQ-05 | P1 | Manual | — | Timesheet→approve→payroll tháng | Số khớp |
| TC-E2E-04 | UC-PLT30 | SEQ-06 | P1 | Manual | — | Daily report→approve | CEO export có data |
| TC-E2E-05 | UC-PT09 | SEQ-07 | P1 | Manual | — | Leave→reassign→Client vẫn tập | PT mới trên HĐ |

---

## Thống kê

| Loại | Số lượng (ước) |
|------|----------------|
| Tổng TC trong file | **~115** |
| P0 (smoke) | **20** (xem SMOKE-REGRESSION.md) |
| Có Auto tương ứng | **~45** |
| Chỉ Manual/UAT | **~70** |

## Cập nhật khi thêm UC

1. Thêm dòng vào section module tương ứng  
2. Cập nhật `TRACEABILITY-MATRIX.md`  
3. Thêm Jest/Playwright nếu automate được  
