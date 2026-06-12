# Smoke & Regression Suites

Chạy trước mỗi release / sau merge `developer`. Tham chiếu luồng: `docs/uml/use-cases/10-cross-module-flows.puml`.

## Smoke (P0) — ~30 phút

| # | TC-ID | Mô tả ngắn | Actor |
|---|-------|------------|-------|
| 1 | TC-G01-01 | Landing 200, CMS hero hiển thị | Guest |
| 2 | TC-G02-01 | POST lead → redirect success | Guest |
| 3 | TC-A01-01 | Login Client → `/client` | Client |
| 4 | TC-A01-02 | Login PT → `/pt` | PT |
| 5 | TC-A01-03 | Login Admin → `/admin` | Admin |
| 6 | TC-CRM10-01 | Admin leads list 200 | Marketing |
| 7 | TC-CTR02-01 | Tạo HĐ Draft | Sales |
| 8 | TC-CTR08-01 | Ghi payment partial | Accountant |
| 9 | TC-CTR08-02 | Ghi payment full → Paid | Accountant |
| 10 | TC-SEQ03-01 | Paid → affiliate Gift F1 | System |
| 11 | TC-CLI05-01 | Client schedule load | Client |
| 12 | TC-SEQ02-01 | QR scan start/end session | PT+Client |
| 13 | TC-CLI03-01 | Feedback sau buổi | Client |
| 14 | TC-CLI10-01 | Meal log upsert | Client |
| 15 | TC-PT07-01 | Timesheet check-in | PT |
| 16 | TC-PT30-01 | Manager approve timesheet | Manager |
| 17 | TC-FIN01-01 | Payroll summary tháng | Accountant |
| 18 | TC-PLT01-01 | Admin dashboard CSAT widget | Admin |
| 19 | TC-PLT30-01 | Submit daily report | PT |
| 20 | TC-SEQ09-01 | Role không quyền → 403 | Sales |

**Auto smoke (CI):**
```powershell
npm run test:ci
npm run test:integration
```

## Regression Sprint 0–6 — ~2–3 giờ

| Module | TC range | Ghi chú |
|--------|----------|---------|
| Public/Auth | TC-G*, TC-A* | + register referral |
| CRM | TC-CRM* | funnel, CMS, content |
| Contracts | TC-CTR* | pause, PDF, scope |
| Client portal | TC-CLI* | xem `uat-sprint6.md` |
| PT ops | TC-PT* | leave, slot, QR |
| Finance | TC-FIN* | VAT expense export |
| Programs | TC-PRG* | meal, workout, KPI |
| Platform | TC-PLT* | checklist, work report |
| Users/RBAC | TC-USR*, TC-PLT70 | SA reset permissions |
| API | TC-API* | calendar cancel |

## E2E Playwright (optional)

```powershell
npm run seed:e2e:faker
npm run test:e2e:pt-client
```

| Spec | Phạm vi |
|------|---------|
| `auth_flow.spec.js` | Login đa role |
| `leads_admin.spec.js` | Lead admin |
| `finance_admin.spec.js` | Payroll/expense UI |
| `pt_client_flows.spec.js` | PT–Client tương tác |
| `workflow_edge_cases.spec.js` | Edge cases |

## Pass criteria

- Smoke: **100% P0 pass**
- Regression: **≥95% P1 pass**, 0 P0 open
- Auto CI: `test:ci` + `test:integration` green
