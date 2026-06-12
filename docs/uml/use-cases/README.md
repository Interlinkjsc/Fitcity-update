# FitCity FMS — Use Case Diagrams (PlantUML)

## Cấu trúc file

| File | Module |
|------|--------|
| `00-actors-overview.puml` | Bản đồ actor ↔ module |
| `01-public-auth.puml` | Public landing + Auth |
| `02-crm.puml` | CRM (leads, CMS, content, branches) |
| `03-contracts.puml` | Hợp đồng & doanh thu |
| `04-clients.puml` | Client portal + admin clients |
| `05-pt-operations.puml` | PT vận hành (QR, slot, timesheet, leave) |
| `06-finance.puml` | Payroll, expenses, coupons, rewards |
| `07-programs.puml` | Packages, meal, metrics, workout, KPI |
| `08-platform.puml` | Dashboard, settings, checklist, reports |
| `09-users-organization.puml` | Users, permissions, branches |
| `10-cross-module-flows.puml` | Luồng nghiệp vụ xuyên module (activity) |
| `11-api-health.puml` | API calendar & health |
| `all-use-cases-index.puml` | Sơ đồ index → mở từng file module |

**Bộ đầy đủ:** xem thêm `../README.md`, `../sequence/`, `../activity/`, `../components/`, `../UC-MASTER-CATALOG.md`.

## Render

### VS Code / Cursor
Cài extension **PlantUML**, mở file `.puml` → `Alt+D` preview.

### CLI (cần Java + Graphviz)
```bash
cd docs/uml/use-cases
plantuml -tpng *.puml
plantuml -tsvg *.puml
```

### Online
Copy nội dung file vào https://www.plantuml.com/plantuml/uml/

## Quy ước
- `UC-XXX##`: mã use case tham chiếu tài liệu phân tích actor.
- `<<include>>` / `<<extend>>`: quan hệ UML chuẩn.
- Phạm vi HĐ theo role: xem `docs/business-rules-and-rbac.md`.
