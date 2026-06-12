# Phase 0 — Chuẩn bị nền tảng DevOps (FitCity)

**Mục tiêu:** Sẵn sàng container & production chuẩn, **chưa** deploy Docker app (Phase 1).

**Thời gian gợi ý:** 1 tuần.

## Tài liệu trong phase này

| File | Nội dung |
|------|----------|
| [checklist.md](./checklist.md) | Việc cần làm trên VPS + repo, có checkbox |
| [inventory.md](./inventory.md) | Port, env, cron, dependency, rủi ro |

## Artifact repo

| Path | Mục đích |
|------|----------|
| `deploy/env/.env.production.example` | Mẫu biến môi trường production |
| `deploy/server/phase-0-ubuntu.sh` | Script cài Docker + firewall (chạy trên VPS) |
| `docs/runbooks/` | Thư mục runbook (Phase 2+) |

## Thứ tự thực hiện

1. Đọc [inventory.md](./inventory.md) — xác nhận domain, backup, Google Drive.
2. **Snapshot VPS** trước khi đổi OS hoặc chạy script.
3. Làm [checklist.md](./checklist.md) mục **0.1 → 0.7**.
4. Đánh dấu **Definition of Done** cuối checklist.
5. Chuyển **Phase 1** (Dockerfile + Compose staging).

## VPS tham chiếu (cập nhật khi đổi máy)

| Thuộc tính | Giá trị hiện tại (ghi nhận) |
|------------|-----------------------------|
| IP | `160.25.81.177` |
| OS ban đầu | Ubuntu 18.04 x64 → **nâng 22.04** |
| CPU / RAM / Disk | 2 core / 4 GB / 30 GB |

## Definition of Done — Phase 0

- [ ] Ubuntu **22.04 LTS** (hoặc máy mới 22.04, DNS trỏ xong)
- [ ] Docker Engine + Compose plugin (`docker compose version`)
- [ ] UFW: chỉ **22, 80, 443** (Mongo **không** public)
- [ ] File `deploy/env/.env.production` trên server (không commit), đủ biến bắt buộc
- [ ] Google credentials mount/read-only, backup riêng
- [ ] DNS A record → VPS; kế hoạch TLS (Phase 1 Nginx)
- [ ] Snapshot/backup VPS hoặc image trước thay đổi lớn
- [ ] Inventory & checklist reviewed bởi ít nhất 1 người trong team
