# FitCity FMS — Bộ sơ đồ UML đầy đủ (PlantUML)

Tài liệu này mô tả **toàn bộ** gói UML theo module, actor, luồng sequence và kiến trúc component — đồng bộ với codebase Sprint 0–6.

## Cấu trúc thư mục

```
docs/uml/
├── README.md                    ← bạn đang đọc
├── UC-MASTER-CATALOG.md         ← ~120 UC: ID, route, permission
├── use-cases/                   ← Use Case Diagram (theo module)
│   ├── 00-actors-overview.puml
│   ├── 01-public-auth.puml … 11-api-health.puml
│   ├── 10-cross-module-flows.puml
│   ├── all-use-cases-index.puml
│   └── README.md
├── sequence/                    ← Sequence Diagram (luồng kỹ thuật)
│   ├── seq-01-lead-to-notify.puml
│   ├── … seq-09-auth-rbac.puml
├── activity/                    ← Activity Diagram (theo actor)
│   ├── act-01-guest.puml … act-09-sa.puml
└── components/
    └── package-diagram.puml
```

## Render nhanh

### VS Code / Cursor
Cài **PlantUML** → mở `.puml` → `Alt+D`.

### CLI (Java + Graphviz)
```powershell
cd f:\Sem3_ExpressJs\docs\uml\use-cases
plantuml -tpng *.puml
cd ..\sequence
plantuml -tpng *.puml
cd ..\activity
plantuml -tpng *.puml
cd ..\components
plantuml -tpng *.puml
```

### Online
https://www.plantuml.com/plantuml/uml/

## Bản đồ nội dung

| Loại | Số file | Mục đích |
|------|---------|----------|
| Use case | 12 + catalog | Actor ↔ UC ↔ route |
| Sequence | 9 | Luồng API/controller chính |
| Activity | 9 | Hành trình từng actor |
| Component | 1 | Package `src/modules` |

## Sequence ↔ nghiệp vụ

| File | Luồng |
|------|--------|
| seq-01 | Lead đăng ký → noti Marketing |
| seq-02 | Buổi tập QR Client ↔ PT |
| seq-03 | Thanh toán → Paid → affiliate F1 |
| seq-04 | Client đặt slot PT |
| seq-05 | Timesheet → payroll hybrid |
| seq-06 | Daily report nộp/duyệt |
| seq-07 | PT nghỉ → reassign HĐ |
| seq-08 | Meal plan + meal log |
| seq-09 | Login + RBAC check |

## Activity ↔ actor

| File | Actor |
|------|--------|
| act-01 | Guest |
| act-02 | Client |
| act-03 | PT |
| act-04 | Sales |
| act-05 | Marketing |
| act-06 | Manager |
| act-07 | Accountant |
| act-08 | Admin / CEO |
| act-09 | SA |

## Tham chiếu RBAC

- `docs/business-rules-and-rbac.md`
- `src/core/permissionsRegistry.js`

## Quy ước mã UC

- `UC-G##` Guest, `UC-A##` Auth, `UC-CRM##` CRM, `UC-CTR##` Contracts, …
- Chi tiết từng ID: **UC-MASTER-CATALOG.md**

## Test cases (traceability)

Bộ test case map UC + SEQ + ACT: **`../test-cases/MASTER-TEST-CASES.md`**
