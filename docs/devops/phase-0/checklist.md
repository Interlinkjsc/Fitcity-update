# Phase 0 — Checklist triển khai

Đánh dấu `[x]` khi hoàn thành. **Snapshot VPS** trước mục 0.2 và trước khi chạy script 0.3.

---

## 0.1 — Inventory & quyết định

- [ ] Đọc [inventory.md](./inventory.md)
- [ ] Ghi domain production: `________________________`
- [ ] Ghi domain staging (nếu có): `________________________`
- [ ] Xác nhận ai giữ quyền DNS, SSL, VPS
- [ ] Liệt kê tài khoản admin app (không ghi password vào Git)
- [ ] Quyết định thư mục deploy trên server: mặc định `/opt/fitcity`

---

## 0.2 — Nâng cấp OS (Ubuntu 18.04 → 22.04 LTS)

**Chọn một trong hai:**

### A) VPS mới (khuyến nghị nếu sợ downtime)

- [ ] Tạo VPS Ubuntu **22.04** cùng provider
- [ ] Cài SSH key, tắt login password
- [ ] Trỏ DNS sang IP mới **sau** khi Phase 0 xong trên máy mới
- [ ] Migrate data Mongo (nếu đã có data trên máy cũ): `mongodump` / `mongorestore`

### B) Upgrade in-place (có rủi ro)

- [ ] Snapshot / backup full disk
- [ ] `sudo do-release-upgrade` theo tài liệu Ubuntu (18 → 20 → 22 hoặc reinstall)
- [ ] Reboot, verify `lsb_release -a` → 22.04
- [ ] Cài lại Node, Mongo, Docker nếu upgrade làm mất package

**Sau 0.2:**

- [ ] `uname -a` và `lsb_release -a` ghi vào runbook nội bộ

---

## 0.3 — Docker Engine (chưa deploy app)

Trên VPS (SSH):

```bash
# Hoặc chạy script có review trước:
# sudo bash /opt/fitcity/repo/deploy/server/phase-0-ubuntu.sh
```

- [ ] `docker --version` OK
- [ ] `docker compose version` OK
- [ ] User deploy trong group `docker` (không cần sudo mỗi lệnh)
- [ ] `docker run --rm hello-world` thành công

---

## 0.4 — Firewall (UFW)

- [ ] `sudo ufw default deny incoming`
- [ ] `sudo ufw allow 22/tcp`
- [ ] `sudo ufw allow 80/tcp`
- [ ] `sudo ufw allow 443/tcp`
- [ ] **Không** mở `27017`, `3000` ra public
- [ ] `sudo ufw enable`
- [ ] `sudo ufw status verbose` — chụp/ghi lại

---

## 0.5 — DNS

- [ ] A record `@` hoặc `app` → IP VPS
- [ ] (Tuỳ chọn) A record `staging` → IP staging
- [ ] `dig +short app.yourdomain.com` trả đúng IP
- [ ] TTL và quyền sửa DNS đã rõ

*TLS (Let's Encrypt) triển khai Phase 1 cùng Nginx.*

---

## 0.6 — Secrets & env production

Trên server (không commit Git):

```bash
sudo mkdir -p /opt/fitcity/env
sudo cp deploy/env/.env.production.example /opt/fitcity/env/.env.production
sudo chmod 600 /opt/fitcity/env/.env.production
sudo nano /opt/fitcity/env/.env.production
```

- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` có user/password nếu bật auth Mongo
- [ ] `SESSION_SECRET` — random ≥ 32 ký tự
- [ ] `ENCRYPTION_KEY` — đúng 32 byte (khớp logic app)
- [ ] `QR_HMAC_SECRET` — random mạnh
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` trỏ file JSON trên server
- [ ] File Google JSON: `chmod 600`, owner app user
- [ ] Backup `.env` + JSON ra nơi an toàn (encrypted)

- [ ] App khởi động production **thoát** nếu thiếu biến bắt buộc (`validateEnv`)

---

## 0.7 — Cấu trúc repo & Mongo hardening

### Repo (đã có trong Git)

- [ ] `deploy/`, `docs/devops/phase-0/`, `docs/runbooks/`
- [ ] `.env` không commit (đã trong `.gitignore`)

### Mongo trên VPS (bare metal Phase 0)

- [ ] `bindIp: 127.0.0.1` trong `mongod.conf`
- [ ] Bật authentication: tạo user admin + user app
- [ ] `wiredTigerCacheSizeGB: 1` (máy 4GB RAM)
- [ ] `systemctl enable mongod` / verify restart OK

### Node (tạm thời trước Docker — nếu vẫn chạy PM2)

- [ ] Cài Node 20 LTS (`node -v`)
- [ ] Clone repo vào `/opt/fitcity/app`
- [ ] `npm ci --omit=dev`
- [ ] Symlink hoặc `ENV_FILE` trỏ `/opt/fitcity/env/.env.production`

### Monitoring tối thiểu (Phase 0)

- [ ] `htop`, `sysstat` (`iostat`, `vmstat`)
- [ ] Cron ghi metric (tuỳ chọn): xem kế hoạch monitoring trước đó
- [ ] UptimeRobot ping URL (sau khi có `/health` — Phase 1)

---

## 0.8 — Backup & snapshot

- [ ] Snapshot VPS từ panel provider
- [ ] Lịch `mongodump` daily (cron host) — document path backup
- [ ] Test restore **một lần** vào thư mục tạm (không cần full drill Phase 4)

---

## Sign-off Phase 0

| Vai trò | Tên | Ngày |
|---------|-----|------|
| Thực hiện | | |
| Review | | |

**Chuyển Phase 1 khi:** tất cục Definition of Done trong [README.md](./README.md) đã tick.
