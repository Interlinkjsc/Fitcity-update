# Traceability Matrix — UC ↔ TC ↔ Automated Test

| UC ID | TC-ID (chính) | Auto test file |
|-------|---------------|----------------|
| UC-G02 | TC-G02-01 | `tests/unit/leadController.test.js`, `leadNotifyService.test.js` |
| UC-A01 | TC-A01-01 | `tests/integration/auth.test.js`, `tests/e2e/auth_flow.spec.js` |
| UC-A02 | TC-A02-01 | `tests/integration/auth.test.js` |
| UC-CRM10 | TC-CRM10-01 | `tests/e2e/leads_admin.spec.js` |
| UC-CRM11 | TC-CRM11-01 | `tests/unit/leadFunnelService.test.js` |
| UC-CRM20 | TC-CRM20-01 | `tests/unit/cmsService.test.js` |
| UC-CTR08 | TC-CTR08-01 | `tests/integration/payment.test.js`, `paymentService.test.js` |
| UC-CTR30 | TC-CTR30-01 | `tests/unit/affiliateService.test.js` |
| UC-CLI02 | TC-CLI02-01 | `tests/integration/qr_session_flow.test.js` |
| UC-CLI10 | TC-CLI10-01 | `tests/unit/mealLogService.test.js` |
| UC-PT05 | TC-PT05-01 | `tests/integration/qr_session_flow.test.js`, `qrToken.test.js` |
| UC-PT07 | TC-PT07-01 | `tests/unit/timesheetService.test.js` |
| UC-PT09 | TC-PT09-01 | `tests/unit/ptLeaveService.test.js` |
| UC-PT13 | TC-PT13-01 | `tests/unit/workoutAssignmentService.test.js` |
| UC-FIN01 | TC-FIN01-01 | `tests/integration/payroll.test.js`, `payrollService.test.js` |
| UC-FIN10 | TC-FIN10-01 | `tests/integration/expense.test.js`, `expenseAggregateService.test.js` |
| UC-PLT30 | TC-PLT30-01 | `tests/unit/dailyReportService.test.js` |
| UC-PLT70 | TC-PLT70-01 | `tests/unit/permissionService.test.js`, `rbac.test.js` |
| UC-API01 | TC-API01-01 | `tests/unit/calendar.test.js` |
| SEQ-01 | TC-SEQ01-01 | `leadNotifyService.test.js` |
| SEQ-02 | TC-SEQ02-01 | `qr_session_flow.test.js` |
| SEQ-03 | TC-SEQ03-01 | `affiliateService.test.js`, `payment.test.js` |
| SEQ-04 | TC-SEQ04-01 | `schedule_flow.test.js`, `scheduleService.test.js` |
| SEQ-05 | TC-SEQ05-01 | `payroll.test.js`, `timesheetService.test.js` |
| SEQ-09 | TC-SEQ09-01 | `authMiddleware.test.js`, `pt_contract_permissions.test.js` |

*Chi tiết từng bước: [MASTER-TEST-CASES.md](./MASTER-TEST-CASES.md)*
