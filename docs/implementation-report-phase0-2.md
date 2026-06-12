# Báo cáo triển khai — Phase 0–4 (cập nhật 2026-05-16)

## Tóm tắt

Đã hoàn thành Phase 0 (tài liệu), Phase 1 (pricing / thời hạn tháng), Phase 2 (RBAC + phạm vi HĐ + CEO dashboard), Phase 3 (payroll/KPI nâng cao), và phần lớn Phase 4 (menu sidebar, quyền tùy chỉnh theo user).

## Phase 0 — Tài liệu

| File | Nội dung |
|------|----------|
| `docs/business-rules-and-rbac.md` | Ma trận quyền, quy tắc giá/buổi, netAmount KPI, phạm vi Manager, quyền tùy chỉnh |

## Phase 2 — Bảo mật & phạm vi dữ liệu

### Registry & middleware
- `permissionsRegistry.js`, `permissionService.js`, `rolePermissionModel.js`
- `checkPermission` thay `restrictTo` trên hầu hết route admin (trừ portal Client và SA permissions UI)
- Quyền tùy chỉnh: `useCustomPermissions` + `customPermissionIds` trên user, UI tại form user

### `contractScopeService.js`
- `buildContractListFilter()`, `canAccessContract()`, aggregate `netAmount`
- Áp dụng trên list/detail/edit/pause/payment/preview HĐ

### Sidebar
- `sidebarMenu.js` lọc menu theo `userHasPermissionSync`

## Phase 3 — KPI & payroll

- Payroll Sales/Manager: % × **netAmount**; PT: tổng `ptCommission` HĐ Paid
- KPI chi nhánh: `contractTarget` trên form KPI
- **Chỉ tiêu cá nhân PT/Sales**: `EmployeeKPITarget`, override branch khi có bản ghi
- UI: form “Lưu chỉ tiêu cá nhân” trên `admin/users/detail.ejs`, route `POST .../kpi-target`
- User detail: picker tháng/năm, HR block, KPI Manager staff tables

## Phase 1 — Thời hạn HĐ theo tháng

- `contractDurationHelper.js`, `durationMonths` trên package & snapshot HĐ
- Script: `scripts/migrate-duration-months.js` (chạy khi DB sẵn sàng)

## Test đã chạy

| Suite | Mô tả |
|-------|--------|
| `tests/unit/permissionService.test.js` | Registry + custom permissions |
| `tests/unit/authMiddleware.test.js` | checkPermission fail-closed |
| `tests/unit/contractScopeService.test.js` | List filter + canAccess |
| `tests/unit/contractDurationHelper.test.js` | Tháng → ngày |
| `tests/unit/kpiService.test.js` | resolveEmployeeTargets |
| `tests/integration/contractScope.test.js` | Manager scope E2E |

Chạy batch unit: `rtk npx jest tests/unit --testPathIgnorePatterns=node_modules`

## Hoàn thiện bổ sung (2026-05-16)

- Integration: `tests/integration/employeeKpiTarget.test.js` (lưu chỉ tiêu + override branch)
- `tests/helpers/testDb.js` — dùng `MONGODB_URI` test (ổn định trên Windows), fallback memory server
- `contractScope.test.js` chuyển sang helper trên (không còn phụ thuộc memory server đơn lẻ)
- Tài liệu KPI cá nhân trong `business-rules-and-rbac.md`

## Tùy chọn sau này

- Marketing/Sales: tinh chỉnh submenu UX

## Rủi ro vận hành

- HĐ cũ thiếu `netAmount` → aggregate fallback `basePrice - discount`
- Sau đổi registry quyền: restart server để refresh cache
