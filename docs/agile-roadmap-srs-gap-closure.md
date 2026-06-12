# Kế hoạch Agile (Scrum) — Bổ sung đáp ứng SRS FitCity FMS

**Phiên bản:** 1.1  
**Ngày:** 2026-05-17  

**Tiến độ Sprint 1:** ✅ Đã triển khai (2026-05-17) — xem mục [Sprint 1 — Đã làm](#sprint-1--đã-làm-trong-code)
**Nguồn:** Đối chiếu `.agent/context/srs_analysis_detailed.txt` với codebase hiện tại  
**Thời lượng:** 6 Sprint × 2 tuần (12 tuần)

---

## Mục lục

1. [Tầm nhìn & mục tiêu sản phẩm](#1-tầm-nhìn--mục-tiêu-sản-phẩm)
2. [Cấu trúc Scrum](#2-cấu-trúc-scrum)
3. [Product Backlog theo Epic](#3-product-backlog-theo-epic)
4. [Lộ trình Sprint (roadmap)](#4-lộ-trình-sprint-roadmap)
5. [Chi tiết Sprint Backlog](#5-chi-tiết-sprint-backlog)
6. [Ma trận phụ thuộc](#6-ma-trận-phụ-thuộc--thứ-tự-triển-khai)
7. [Quản lý rủi ro](#7-quản-lý-rủi-ro-risk-register)
8. [Metrics & theo dõi](#8-metrics--theo-dõi-scrum-master)
9. [Kế hoạch kiểm thử theo Sprint](#9-kế-hoạch-kiểm-thử-theo-sprint)
10. [Sprint 0](#10-sprint-0-1-tuần-trước-s1--khuyến-nghị)
11. [Gợi ý phân team](#11-gợi-ý-phân-team-nếu-song-song)
12. [Tóm tắt cam kết theo SRS](#12-tóm-tắt-cam-kết-theo-srs)
13. [Phụ lục: Baseline độ phủ module](#13-phụ-lục-baseline-độ-phủ-module-trước-khi-bắt-đầu)

---

## 1. Tầm nhìn & mục tiêu sản phẩm

### Vision

Hoàn thiện FMS web-app để đạt **≥90% chức năng SRS cốt lõi**, giữ nguyên các quyết định add-on đã chốt:

- Xác nhận buổi tập qua **web-app** (không OTP SMS).
- Thông báo qua **in-app** (không Zalo OA / auto-email).
- Báo cáo **theo kỳ thủ công** (không gửi email tự động).

### Product Goal (12 tuần)

- Đóng khoảng trống **CEO / Manager / Kế toán / Client** theo ma trận SRS.
- Không phá vỡ RBAC, contract scope, payroll hiện có.
- Mỗi Sprint kết thúc bằng **demo trên staging** + CI pass.

### Nguyên tắc ưu tiên (MoSCoW)

| Mức | Phạm vi |
|-----|---------|
| **Must** | Checklist CEO, đánh giá PT, VAT/com CEO, timesheet→payroll, expense VAT, daily report, lead metrics + notify |
| **Should** | JD UI, lộ trình KH, meal log, affiliate F1/F2, CMS marketing cơ bản |
| **Could** | Blog/Contact, UI hộp quà, filter chart 30-60-90, chứng từ thuế đa loại Drive |
| **Won't (v1)** | Zalo OA, OTP SMS, auto-email báo cáo, app native |

### Giả định team

| Vai trò | Số lượng |
|---------|----------|
| Product Owner | 1 |
| Scrum Master | 1 |
| Developer (full-stack) | 2–3 |
| QA | 1 |

**Velocity giả định:** 35–45 Story Points / sprint (2 tuần).

---

## 2. Cấu trúc Scrum

### Vai trò

| Vai trò | Trách nhiệm |
|---------|-------------|
| **Product Owner** | Ưu tiên backlog, chốt nghiệp vụ với CEO/Kế toán (VAT, nguồn thu, timesheet). |
| **Scrum Master** | Sprint planning, daily, retro, gỡ blocker, theo dõi velocity. |
| **Dev Team** | Full-stack Express/EJS/MongoDB; giữ pattern `src/modules/*`. |
| **QA** | Test plan theo AC; regression RBAC + contract + payroll. |

### Nghi thức (mỗi Sprint 2 tuần)

| Ceremony | Thời lượng | Đầu ra |
|----------|------------|--------|
| Sprint Planning | 4h | Sprint Goal + Sprint Backlog cam kết |
| Daily Scrum | 15 phút/ngày | Blocker, tiến độ |
| Backlog Refinement | 1h/tuần | Story ≤ 8 SP, AC rõ |
| Sprint Review | 2h | Demo stakeholder |
| Sprint Retrospective | 1.5h | 1–3 cải tiến quy trình |

### Definition of Ready (DoR)

- User story có **Acceptance Criteria**, mockup/wireframe (nếu UI).
- Permission mới (nếu có) đã draft trong `src/core/permissionsRegistry.js`.
- PO đã trả lời câu hỏi mở (≤ 1 ngày làm việc).

### Definition of Done (DoD)

- [ ] Code merge `main`, CI green (unit + integration liên quan).
- [ ] RBAC: `checkPermission` + test deny/allow.
- [ ] Không regression: contract scope, payroll, QR session.
- [ ] EJS responsive (client + admin).
- [ ] Cập nhật seed/demo data nếu cần demo.
- [ ] Cập nhật `docs/business-rules-and-rbac.md` nếu đổi quyền/nghiệp vụ.
- [ ] PO sign-off trên staging.

### Quy ước Story Point

| SP | Ý nghĩa |
|----|---------|
| 1–2 | Thay đổi nhỏ, 1 file |
| 3–5 | Feature vừa, vài file + test |
| 8 | Feature lớn, cần chia nhỏ nếu vượt |
| 13 | Epic — bắt buộc tách trước Sprint Planning |

---

## 3. Product Backlog theo Epic

### E1 — Governance CEO

| Epic ID | Mô tả | Sprint |
|---------|-------|--------|
| E1 | Checklist Task, VAT/commission hệ thống, báo cáo công việc | S1, S4 |

### E2 — Chất lượng dịch vụ

| Epic ID | Mô tả | Sprint |
|---------|-------|--------|
| E2 | Đánh giá PT, dashboard CSAT Manager | S1, S4 |

### E3 — HR & Payroll

| Epic ID | Mô tả | Sprint |
|---------|-------|--------|
| E3 | Timesheet chấm công, tích hợp payroll | S2 |

### E4 — Tài chính nội bộ

| Epic ID | Mô tả | Sprint |
|---------|-------|--------|
| E4 | Expense pre-VAT/VAT, chứng từ thuế Drive | S3 |

### E5 — CRM & Marketing

| Epic ID | Mô tả | Sprint |
|---------|-------|--------|
| E5 | Lead form metrics, notify, CMS, kho nội dung | S5 |

### E6 — Client Experience

| Epic ID | Mô tả | Sprint |
|---------|-------|--------|
| E6 | Meal log, affiliate F1/F2, lộ trình, chart 30-60-90 | S6 |

### E7 — Admin & HR

| Epic ID | Mô tả | Sprint |
|---------|-------|--------|
| E7 | Job Description UI, Daily Report Manager | S1, S4 |

### Sơ đồ phụ thuộc Epic

```
E1 (CEO governance) ──► E3 (timesheet/payroll)
E3 ──► E4 (finance reports)
E2 (rating) ──► E1 (CEO quality reports)
E5 (CRM/MKT) ──► E6 (client)
E7 (JD) ──► S1 (user onboarding)
```

---

## 4. Lộ trình Sprint (roadmap)

| Sprint | Tuần | Sprint Goal | Epic | SP cam kết |
|--------|------|-------------|------|------------|
| **S0** | 0 | Chuẩn bị backlog, ERD, workshop PO | — | — |
| **S1** | 1–2 | Governance CEO + đánh giá PT MVP | E1, E2, E7 | 38 |
| **S2** | 3–4 | Timesheet HR + tích hợp payroll | E3 | 40 |
| **S3** | 5–6 | Kế toán: chi phí VAT + chứng từ Drive | E4 | 38 |
| **S4** | 7–8 | Manager: daily report + CSAT dashboard | E7, E2, E1 | 36 |
| **S5** | 9–10 | CRM/MKT: lead đầy đủ + CMS cơ bản | E5 | 42 |
| **S6** | 11–12 | Client: meal log, affiliate, lộ trình + hardening | E6, E7 | 40 |

### Release milestones

| Release | Sau sprint | Nội dung |
|---------|------------|----------|
| **R1** | S2 | CEO checklist + rating + timesheet/payroll — vận hành nội bộ |
| **R2** | S4 | Kế toán + Manager báo cáo — đủ SRS nhóm 1–2 |
| **R3** | S6 | Marketing + Client nâng cao — ≥90% SRS |

---

## 5. Chi tiết Sprint Backlog

### Sprint 0 — Chuẩn bị (1 tuần)

| ID | Hạng mục | Owner | Thời gian |
|----|----------|-------|-----------|
| S0-01 | PO workshop: VAT, công thức timesheet, mẫu checklist | PO | 4h |
| S0-02 | Thiết kế DB draft (ERD) cho model mới | Dev lead | 1 ngày |
| S0-03 | Import backlog Jira/Linear + MoSCoW | SM | 0.5 ngày |
| S0-04 | Staging Google Drive + env | DevOps | 0.5 ngày |
| S0-05 | Baseline SRS scorecard (theo module) | SM | 0.5 ngày |

**Model mới dự kiến:**

- `ChecklistTask`
- `SystemSettings`
- `Timesheet`
- `DailyReport`
- `PTLeaveRequest`
- `ContentAsset` / `SiteContent`
- `MealLog`
- `ClientProgramAssignment`
- Mở rộng `Expense` (pre-VAT, VAT, tax document type)

---

### Sprint 1 — Governance & chất lượng PT

**Sprint Goal:** CEO có checklist và cài VAT/com; Client/Manager có luồng đánh giá PT; dashboard hiển thị % phản hồi cơ bản.

| ID | User Story | SP | Epic | Module |
|----|------------|-----|------|--------|
| S1-01 | Là **CEO/Manager**, tôi tạo/sửa/xóa **Checklist Task** (tiêu đề, deadline, assignee, trạng thái) để kiểm soát tiến độ. | 8 | E1 | `platform` (mới) |
| S1-02 | Là **CEO**, tôi sửa **VAT mặc định** và **% commission PT mặc định** hệ thống. | 5 | E1 | `platform`, `users` |
| S1-03 | Là **Client**, sau buổi **Completed**, tôi đánh giá PT (1–5 sao + ghi chú). | 8 | E2 | `clients`, `programs` |
| S1-04 | Là **Manager**, tôi xem **% buổi có rating** và điểm TB theo PT/CN/tháng. | 5 | E2 | `platform`, `crm` |
| S1-05 | Là **Admin**, tôi quản lý **Job Description** danh mục theo role. | 5 | E7 | `users` |
| S1-06 | **Tech:** permissions + seed + tests checklist, settings, feedback. | 7 | — | `core`, `tests` |

#### Acceptance Criteria — S1-01 (Checklist Task)

- [ ] CRUD tại `/admin/checklists` (hoặc `/admin/tasks`).
- [ ] Roles: SA, Admin, CEO, Manager (theo ma trận SRS).
- [ ] Filter theo chi nhánh, assignee, trạng thái (Todo / In Progress / Done).
- [ ] Noti in-app khi được gán task.
- [ ] Permission mới trong `permissionsRegistry.js`.

#### Acceptance Criteria — S1-02 (System Settings)

- [ ] Model `SystemSettings` (singleton hoặc key-value): `defaultVat`, `defaultPtCommissionRate`.
- [ ] UI `/admin/settings` — CEO và Admin (`system_settings.update`).
- [ ] HĐ mới lấy default; HĐ cũ không đổi retroactive.
- [ ] Thay stub `POST /admin/users/settings/vat`.

#### Acceptance Criteria — S1-03 (Đánh giá PT)

- [ ] `POST /client/sessions/:id/feedback` — rating 1–5, comment optional.
- [ ] Chỉ buổi `Completed`; client chỉ feedback buổi của mình.
- [ ] Một buổi chỉ feedback một lần.
- [ ] PT không sửa/xóa feedback.

#### Acceptance Criteria — S1-04 (CSAT Dashboard)

- [ ] Widget trên `/admin` hoặc trang `/admin/quality`.
- [ ] Metrics: % buổi có rating, điểm TB, theo PT và chi nhánh.
- [ ] Filter tháng/quý.

#### Acceptance Criteria — S1-05 (Job Description)

- [ ] CRUD JD template theo role (Admin only).
- [ ] Form tạo user: chọn JD từ danh mục → gán vào `user.jobDescription`.
- [ ] Thay stub `GET /admin/users/settings/jd`.

**Phụ thuộc:** PO chốt fields checklist trước Sprint Planning.  
**Rủi ro:** Quyền CEO sửa VAT — workshop Sprint 0.

---

### Sprint 2 — Timesheet & Payroll

**Sprint Goal:** PT/Staff chấm công ca dạy; Accountant xem timesheet; payroll đối soát được với ca/buổi.

| ID | User Story | SP | Epic | Module |
|----|------------|-----|------|--------|
| S2-01 | Là **PT**, tôi **check-in/check-out ca dạy** tại chi nhánh (tách khỏi QR buổi KH). | 8 | E3 | `pt` |
| S2-02 | Là **Accountant/Manager**, tôi xem **bảng chấm công** theo tháng/CN/PT. | 5 | E3 | `pt` / `finance` |
| S2-03 | Là **Accountant**, payroll **tham chiếu timesheet** + HĐ commission. | 8 | E3 | `finance` |
| S2-04 | Là **Manager**, tôi **duyệt/sửa** timesheet bất thường. | 5 | E3 | `pt` |
| S2-05 | **Tech:** permission “Chấm công” cho Accountant; tests E2E timesheet→payroll. | 6 | E3 | `core`, `tests` |

#### Acceptance Criteria — S2-01 (Timesheet)

- [ ] Model `Timesheet`: staff, branch, checkIn, checkOut, status, notes.
- [ ] Routes `/pt/attendance` (check-in/out).
- [ ] MVP: manual tại chi nhánh (không bắt buộc GPS v1).
- [ ] Tài liệu phân biệt: **QR buổi = buổi khách**; **Timesheet = ca làm PT**.

#### Acceptance Criteria — S2-03 (Payroll hybrid)

- [ ] Cấu hình payroll mode: `contract` | `timesheet` | `hybrid` (per role hoặc global).
- [ ] UI payroll summary hiển thị nguồn tính.
- [ ] Không double-count nếu rule = contract-only.

**Spike (4h, trước S2):** PO + Kế toán chốt công thức: % HĐ vs ₫/ca vs buổi QR.

---

### Sprint 3 — Tài chính nội bộ (Kế toán)

**Sprint Goal:** Chi phí tách pre-VAT/VAT; upload chứng từ Drive; báo cáo nội bộ khớp SRS comment.

| ID | User Story | SP | Epic | Module |
|----|------------|-----|------|--------|
| S3-01 | Là **Accountant**, tôi nhập chi **amountBeforeVat**, **vatRate**, **vatAmount**, **total**. | 8 | E4 | `finance` |
| S3-02 | Gắn **loại chứng từ thuế** + upload Google Drive. | 8 | E4 | `finance`, `platform` |
| S3-03 | Dashboard chi theo loại + VAT; export Excel quý cập nhật. | 5 | E4 | `platform`, `finance` |
| S3-04 | Tag **nguồn thu** trên HĐ (PT contract / subscription MVP). | 5 | E4 | `contracts` |
| S3-05 | Migration script + tests regression dashboard. | 5 | E4 | `tests` |

#### Loại chứng từ (đề xuất enum)

- `OUTPUT_VAT` — Hóa đơn thuế đầu ra (xuất cho khách)
- `INPUT_VAT` — Chi phí đầu vào (thuê VP, điện nước…)
- `PIT` — Thuế thu nhập cá nhân
- `SOCIAL_INSURANCE` — BHXH
- `OTHER` — Không thuế / khác

#### Acceptance Criteria — S3-01

- [ ] Form tính tự động: `total = beforeVat + vatAmount`.
- [ ] Category có flag `vatExempt`.
- [ ] Migration: `amount` cũ → `amountBeforeVat`, `vatRate=10` default.

---

### Sprint 4 — Manager vận hành

**Sprint Goal:** Daily Report nhân sự; Manager duyệt; CEO xuất báo cáo công việc tháng.

| ID | User Story | SP | Epic | Module |
|----|------------|-----|------|--------|
| S4-01 | Là **PT/Sales**, tôi nộp **Daily Report** hàng ngày. | 8 | E7 | `crm` hoặc `programs` |
| S4-02 | Là **Manager**, tôi **duyệt/từ chối** daily report CN mình. | 5 | E7 | `crm` |
| S4-03 | Là **CEO**, tôi **xuất báo cáo công việc tháng** (checklist + daily report). | 8 | E1 | `platform` |
| S4-04 | Dashboard Manager: CSAT + % hoàn thành daily report. | 5 | E2 | `platform` |
| S4-05 | Flow **PT nghỉ giữa kỳ** → reassign HĐ/PT. | 8 | E1 | `pt`, `contracts` |
| S4-06 | Tests + permissions Manager vs PT. | 5 | — | `tests` |

#### Acceptance Criteria — S4-03

- [ ] Export Excel/PDF theo tháng/quý/CN.
- [ ] Không auto-email (đúng add-on).
- [ ] Pull data từ ChecklistTask + DailyReport.

---

### Sprint 5 — CRM & Marketing

**Sprint Goal:** Form lead đủ metrics; auto-noti Sales; CMS banner/blog cơ bản; kho nội dung.

| ID | User Story | SP | Epic | Module |
|----|------------|-----|------|--------|
| S5-01 | Landing form thêm **cân nặng, chiều cao, % mỡ, mục tiêu**. | 3 | E5 | `crm`, `views` |
| S5-02 | Lead mới → **noti in-app** Marketing/Manager CN. | 5 | E5 | `crm`, `platform` |
| S5-03 | **Kho nội dung** (ảnh/video/text + Drive). | 8 | E5 | `crm` (mới) |
| S5-04 | **CMS:** banner, blog, SEO meta trên website. | 13 | E5 | `crm`, `views` |
| S5-05 | Trang **Contact** + form → lead. | 5 | E5 | `views`, `crm` |
| S5-06 | **Funnel** lead → Signed trên `/admin/leads`. | 5 | E5 | `crm` |
| S5-07 | Tests lead notify + CMS smoke. | 3 | E5 | `tests` |

#### Acceptance Criteria — S5-04 (CMS MVP)

- [ ] Model `SiteContent`: key, type (banner/post/seo), body, imageUrl, published.
- [ ] Admin `/admin/cms` — Marketing role.
- [ ] Public: home sections đọc từ DB; blog list + 1 post detail.
- [ ] Won't v1: full WYSIWYG, multi-language.

#### Ghi chú scope

- Có thể tách S5-04 thành 8 SP (banner) + 5 SP (blog) nếu team nhỏ.

---

### Sprint 6 — Client & hoàn thiện

**Sprint Goal:** Meal log, affiliate F1/F2, lộ trình KH, polish; regression & UAT.

| ID | User Story | SP | Epic | Module |
|----|------------|-----|------|--------|
| S6-01 | **Nhật ký bữa ăn** hàng ngày (Client). | 8 | E6 | `clients`, `programs` |
| S6-02 | **Affiliate F1/F2** — mã, thưởng khi F1 ký HĐ Paid. | 8 | E6 | `users`, `finance` |
| S6-03 | **Lộ trình tuần** gán WorkoutProgram cho từng KH. | 8 | E6 | `programs`, `pt` |
| S6-04 | Chart progress filter **30 / 60 / 90 ngày**. | 3 | E6 | `programs` |
| S6-05 | UI **coupon hộp quà** trên `/client/rewards`. | 5 | E6 | `views` |
| S6-06 | Hoàn thiện **meal plan detail** (thay stub). | 3 | E6 | `programs` |
| S6-07 | **Hardening:** regression, fix P1, cập nhật docs. | 5 | — | all |
| S6-08 | **UAT script** + demo đa role (1 buổi). | 3 | — | — |

#### Acceptance Criteria — S6-02 (Affiliate)

- [ ] Client thấy `referralCode`, danh sách F1 (users có `referredBy = me`).
- [ ] Khi F1 có HĐ `Paid` → trigger reward (coupon hoặc points — PO chọn).
- [ ] F2 (optional v1): chỉ hiển thị, chưa hoa hồng.

---

## 6. Ma trận phụ thuộc & thứ tự triển khai

| Story | Phụ thuộc | Ghi chú |
|-------|-----------|---------|
| S2-03 | S2-01, S2-02 | Payroll hybrid cần timesheet data |
| S3-03 | S3-01 | Report VAT |
| S4-03 | S1-01, S4-01 | Báo cáo công việc |
| S5-04 | S5-03 (optional) | CMS có thể dùng Drive-only MVP |
| S6-02 | Contract `paymentStatus=Paid` | Hook event sau thanh toán |
| S1-02 | PO sign-off | Tránh conflict `contract.vat` per-HĐ |

### Thứ tự merge khuyến nghị

```
S0 → S1 → S2 → S3 → S4 → S5 → S6
         ↘ S4 có thể bắt đầu draft song song cuối S3 (không merge trước S1-01)
```

---

## 7. Quản lý rủi ro (Risk Register)

| ID | Rủi ro | P | I | Giảm thiểu |
|----|--------|---|---|------------|
| R1 | Công thức lương PT không thống nhất | Cao | Cao | Spike S2; workshop PO + Kế toán 2h |
| R2 | Drive API quota/lỗi production | TB | Cao | Feature flag; fallback `invoiceImage` local |
| R3 | Nhầm QR buổi vs timesheet | TB | TB | Tài liệu + UI label rõ |
| R4 | CMS phình scope | Cao | TB | MVP banner + 1 blog; Won't full SEO |
| R5 | Migration expense breaking data | TB | Cao | Script + backup; deploy off-hours |
| R6 | CEO vs Admin quyền VAT | TB | TB | Chốt ma trận Sprint 0 |

---

## 8. Metrics & theo dõi (Scrum Master)

| Metric | Mục tiêu |
|--------|----------|
| Sprint Velocity | Ổn định ±15% sau S2 |
| Sprint Goal success | ≥80% sprint đạt goal |
| Defect escape (UAT) | ≤5 P1/sprint sau S3 |
| SRS coverage (Must items) | 100% sau S4 |
| SRS coverage (tổng) | ≥90% sau S6 |
| CI pass rate | 100% trước merge |
| Cycle time | Story ≤8 SP xong trong 1 sprint |

### Impediment log (mẫu)

| Ngày | Impediment | Owner | Trạng thái |
|------|------------|-------|------------|
| | | | Open / Resolved |

---

## 9. Kế hoạch kiểm thử theo Sprint

| Sprint | Test trọng tâm | Loại |
|--------|----------------|------|
| S1 | RBAC checklist/settings; feedback 1 lần/buổi; deny PT sửa feedback | Unit + Integration |
| S2 | Timesheet approve; payroll hybrid; no double-count | Integration E2E |
| S3 | Expense VAT math; Drive mock; dashboard totals | Unit + Integration |
| S4 | Daily report chain; CEO export | Integration |
| S5 | Lead fields; noti on create; CMS public render | Smoke + Integration |
| S6 | Meal log; affiliate on Paid; chart filter; **full regression** | Regression + UAT |

### UAT checklist (S6 — 20 case tối thiểu)

1. CEO: tạo checklist, gán Manager, đánh dấu Done.
2. CEO: đổi VAT default → tạo HĐ mới thấy VAT mới.
3. Client: confirm buổi → feedback PT.
4. Manager: xem CSAT % theo CN.
5. PT: timesheet check-in/out.
6. Accountant: xem timesheet, chạy payroll hybrid.
7. Accountant: nhập expense có VAT.
8. Accountant: upload chứng từ Drive.
9. PT: nộp daily report.
10. Manager: duyệt daily report.
11. CEO: export báo cáo công việc tháng.
12. Marketing: upload asset kho nội dung.
13. Marketing: đổi banner home.
14. Public: gửi form lead đủ metrics.
15. Marketing: nhận noti lead mới.
16. Client: ghi meal log.
17. Client: xem referral code + F1.
18. PT: gán lộ trình tuần cho KH.
19. Client: chart 30 ngày.
20. Regression: QR session flow vẫn pass.

---

## 10. Sprint 0 (1 tuần trước S1) — Khuyến nghị

### Deliverables Sprint 0

- [ ] ERD các model mới (review team).
- [ ] Backlog Jira/Linear với Epic E1–E7.
- [ ] Document quyết định: công thức payroll, ma trận CEO VAT.
- [ ] Staging env Drive verified.
- [ ] Baseline SRS % (mục 13).

### Workshop PO (agenda 4h)

1. Checklist Task — fields & workflow (30’).
2. VAT: default vs per-contract (30’).
3. Timesheet vs QR buổi — định nghĩa (45’).
4. Expense VAT — loại chứng từ (30’).
5. Affiliate F1/F2 — rule thưởng (30’).
6. CMS MVP scope — banner/blog (30’).
7. Q&A & ưu tiên MoSCoW (45’).

---

## 11. Gợi ý phân team (nếu song song)

| Track A — Backend nghiệp vụ | Track B — UI / Client |
|------------------------------|------------------------|
| S1-01, S1-02, S2-*, S3-* | S1-03, S1-04, S6-04, S6-05 |
| S4-01, S4-03, S4-05 | S5-01, S5-04, S5-05, S6-01 |
| Payroll, timesheet, expense | Landing, client EJS |

**Sync point:** Cuối mỗi tuần — API contract không breaking; changelog cho QA.

---

## 12. Tóm tắt cam kết theo SRS

| Nhóm SRS | Sprint hoàn thành chính | Mức đạt ước tính |
|----------|-------------------------|------------------|
| CEO (checklist, VAT, báo cáo) | S1 + S4 | ~95% |
| Manager (CSAT, daily report, doanh thu) | S1 + S4 | ~90% |
| PT (timesheet, lộ trình) | S2 + S6 | ~88% |
| Kế toán (VAT chi, chứng từ) | S3 | ~85% |
| Marketing (lead, CMS, kho) | S5 | ~80% |
| Client (rating, meal log, affiliate) | S1 + S6 | ~88% |
| **Tổng hệ thống** | S6 + hardening | **~90%** |

### Add-on đã chốt (không thay đổi)

| # | Quyết định | Sprint liên quan |
|---|------------|------------------|
| 1 | Xác nhận buổi web-app, không OTP | Giữ nguyên — S1-03 bổ sung feedback sau completed |
| 2 | Noti in-app, không Zalo/Email | S5-02, S1-01 noti |
| 3 | Báo cáo thủ công, không auto-email | S4-03, S3-03 |

---

## 13. Phụ lục: Baseline độ phủ module (trước khi bắt đầu)

| Module | Độ phủ SRS | Gap chính |
|--------|------------|-----------|
| `core` | ~95% | Thiếu permission Checklist |
| `auth` | ~85% | — |
| `users` | ~70% | JD UI, VAT stub |
| `platform` | ~80% | Checklist, báo cáo công việc |
| `crm` | ~75% | Lead metrics UI, CMS, notify |
| `contracts` | ~90% | Chứng từ thuế đa loại |
| `finance` | ~72% | VAT expense, timesheet payroll |
| `programs` | ~78% | Meal log, lộ trình KH, feedback route |
| `pt` | ~82% | Timesheet HR |
| `clients` | ~75% | Rating, affiliate UI, meal log |
| `api` | ~85% | — |
| Public / landing | ~55% | Blog, Contact, body metrics form |

**Tổng ước lượng baseline:** ~68–72% → **mục tiêu sau S6:** ~90%.

---

## Phụ lục B — Import Jira/Linear (CSV header)

```csv
Issue Key,Summary,Epic,Story Points,Sprint,Priority,Labels,Acceptance Criteria
S1-01,Checklist Task CRUD,E1,8,S1,High,ceo;manager,"CRUD /admin/checklists; RBAC; noti"
S1-02,System Settings VAT and PT commission,E1,5,S1,High,ceo;admin,"Model SystemSettings; UI /admin/settings"
...
```

---

## Phụ lục C — Tài liệu tham chiếu

- SRS: `.agent/context/srs_analysis_detailed.txt`
- Quy tắc nghiệp vụ: `docs/business-rules-and-rbac.md`
- Permissions: `src/core/permissionsRegistry.js`
- Agile checklist hiện có: `FITCITY_AGILE_CHECKLIST.md`
- Mount routes: `src/core/httpMount.js`

---

## Sprint 1 — Đã làm trong code

| ID | Trạng thái | Ghi chú triển khai |
|----|------------|-------------------|
| S1-01 | ✅ | `/admin/checklists` — CRUD, noti khi giao task |
| S1-02 | ✅ | `/admin/settings` — VAT & % HH PT mặc định; HĐ mới dùng `SystemSettings` |
| S1-03 | ✅ | `POST /client/sessions/:id/feedback` + UI sao trên dashboard client |
| S1-04 | ✅ | Widget CSAT trên `/admin` dashboard |
| S1-05 | ✅ | `/admin/job-descriptions` + chọn mẫu JD khi tạo user |
| S1-06 | ✅ | Tests `systemSettingsService`, `qualityService`; cập nhật `business-rules-and-rbac.md` |
| Bonus | ✅ | Lead form: metrics + noti Marketing/Manager; landing fields |

## Sprint 2 — Đã làm trong code

| ID | Trạng thái | Ghi chú triển khai |
|----|------------|-------------------|
| S2-01 | ✅ | `/pt/attendance` — check-in/out; model `Timesheet` |
| S2-02 | ✅ | `/admin/timesheets` — lọc tháng/CN/trạng thái |
| S2-03 | ✅ | `ptPayrollMode` + `timesheetRatePerShift` trong settings; payroll hybrid |
| S2-04 | ✅ | Manager/Admin duyệt & từ chối ca `Pending_Approval` |
| S2-05 | ✅ | Permissions `timesheet.*`; tests `timesheetService`, payroll timesheet |

## Sprint 3 — Đã làm trong code

| ID | Trạng thái | Ghi chú triển khai |
|----|------------|-------------------|
| S3-01 | ✅ | Expense: `amountBeforeVat`, `vatRate`, `vatAmount`, `total`; form + preview |
| S3-02 | ✅ | `taxDocumentType` + upload Drive (`busboy` + `driveService`) |
| S3-03 | ✅ | Widget VAT + breakdown chứng từ; `/admin/expenses/export` (Excel quý) |
| S3-04 | ✅ | `Contract.revenueSource` + infer + chọn trên form HĐ |
| S3-05 | ✅ | `scripts/migrate-expense-vat.js`; tests `expenseVatHelper` |

## Sprint 4 — Đã làm trong code

| ID | Trạng thái | Ghi chú triển khai |
|----|------------|-------------------|
| S4-01 | ✅ | PT: `/pt/daily-report`; Sales: `/admin/daily-reports/submit` |
| S4-02 | ✅ | `/admin/daily-reports` — Manager duyệt/từ chối |
| S4-03 | ✅ | `/admin/export-work-report` — Excel Checklist + Daily Report |
| S4-04 | ✅ | Widget % daily report + CSAT trên dashboard |
| S4-05 | ✅ | `/pt/leave` + `/admin/pt-leave-requests` — reassign HĐ khi duyệt |
| S4-06 | ✅ | Permissions `daily_report.*`, `pt_leave.*`; unit tests |

## Sprint 5 — Đã làm trong code

| ID | Trạng thái | Ghi chú triển khai |
|----|------------|-------------------|
| S5-01 | ✅ | Landing form: cân nặng, chiều cao, % mỡ, mục tiêu |
| S5-02 | ✅ | Lead mới → noti in-app Marketing/Manager/Admin |
| S5-03 | ✅ | `/admin/content-library` — upload media + Drive |
| S5-04 | ✅ | CMS: `/admin/cms`; banner/SEO hero; `/blog`, `/blog/:slug` |
| S5-05 | ✅ | `/contact` — form → lead `source=Contact` |
| S5-06 | ✅ | Phễu F → Contacted → Signed trên `/admin/leads`; cập nhật status |
| S5-07 | ✅ | Tests: `leadFunnelService`, `cmsService`, `leadNotifyService` |

## Sprint 6 — Đã làm trong code

| ID | Trạng thái | Ghi chú triển khai |
|----|------------|-------------------|
| S6-01 | ✅ | Nhật ký bữa ăn trên `/client/nutrition` — `MealLog` + POST `/client/meal-log` |
| S6-02 | ✅ | Affiliate F1: mã trên profile, thưởng Gift khi F1 HĐ `Paid`; hook `paymentService` |
| S6-03 | ✅ | PT `/pt/workout-assignments` → `ClientWorkoutAssignment`; client `/client/workouts` |
| S6-04 | ✅ | `/client/progress?days=30\|60\|90` |
| S6-05 | ✅ | UI hộp quà (type `Gift`) trên `/client/rewards` |
| S6-06 | ✅ | `/pt/meal-plans/:id` chi tiết thực đơn (thay stub) |
| S6-07 | ✅ | Unit tests + cập nhật docs |
| S6-08 | ✅ | `docs/uat-sprint6.md` |

---

*Cập nhật lần cuối: 2026-05-17 — v1.6 (roadmap SRS gap closure hoàn tất)*
