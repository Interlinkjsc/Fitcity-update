# FitCity FMS — Test Cases (traceability UML)

Bộ test case bám theo:

- **UC:** `docs/uml/UC-MASTER-CATALOG.md` (~120 use case)
- **Sequence:** `docs/uml/sequence/seq-01` … `seq-09`
- **Activity:** `docs/uml/activity/act-01` … `act-09`
- **Luồng E2E:** `docs/uml/use-cases/10-cross-module-flows.puml`

## File

| File | Nội dung |
|------|----------|
| [MASTER-TEST-CASES.md](./MASTER-TEST-CASES.md) | Toàn bộ TC theo module |
| [SMOKE-REGRESSION.md](./SMOKE-REGRESSION.md) | Smoke 30 case + regression sprint |
| [TRACEABILITY-MATRIX.md](./TRACEABILITY-MATRIX.md) | UC ↔ TC ↔ test tự động |

## Quy ước

| Field | Ý nghĩa |
|-------|---------|
| **TC-ID** | `TC-{MODULE}{số}-{variant}` |
| **Priority** | P0 blocker, P1 core, P2 nice-to-have |
| **Type** | `Auto` (Jest/Playwright), `Manual` (UAT) |
| **UC** | Mã use case catalog |
| **SEQ/ACT** | Tham chiếu sơ đồ UML |

## Chạy test tự động

```powershell
cd f:\Sem3_ExpressJs
npm run test:ci          # unit (Jest)
npm run test:integration # integration
npm run test:e2e:pt-client  # Playwright (cần server + seed)
```

## UAT Sprint 6

Checklist chi tiết client/affiliate: `docs/uat-sprint6.md` (map TC-CLI*, TC-SEQ03).
