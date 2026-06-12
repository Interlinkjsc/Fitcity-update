# FitCity — Infrastructure inventory (Phase 0)

*Tài liệu sống: cập nhật khi thêm service, env, hoặc đổi port.*

## 1. Application stack

| Thành phần | Công nghệ | Ghi chú |
|------------|-----------|---------|
| Runtime | Node.js (LTS khuyến nghị 20.x) | `package.json` main: `src/server.js` |
| Framework | Express 5 | EJS views |
| Database | MongoDB (Mongoose) | Phase 0: cùng VPS; sau có thể Atlas |
| Session | `connect-mongo` | Collection `sessions`, cùng `MONGODB_URI` |
| Realtime | Socket.IO | State `onlineUsers` in-memory (1 instance Phase 0–1) |
| Scheduler | `node-cron` | **00:00 hàng ngày** — thanh lý hợp đồng |
| Files | Local `public/` + Google Drive API | PDF hợp đồng / upload |

## 2. Network & ports

| Port | Service | Expose ra Internet? |
|------|---------|---------------------|
| **443** | HTTPS (Nginx — Phase 1) | Có |
| **80** | HTTP redirect TLS | Có |
| **22** | SSH | Có (key-only) |
| **3000** | Node HTTP | **Không** — chỉ `127.0.0.1` qua Nginx |
| **27017** | MongoDB | **Không** — chỉ localhost / Docker network |

## 3. Environment variables

### Bắt buộc production (`validateEnv`)

| Biến | Mô tả | Rủi ro nếu thiếu/default |
|------|--------|---------------------------|
| `NODE_ENV` | `production` | Cookie secure, stack trace |
| `MONGODB_URI` | Connection string Mongo | App không start / data sai |
| `SESSION_SECRET` | Ký session cookie | Session hijack |
| `ENCRYPTION_KEY` | Mã hóa dữ liệu nhạy cảm (32 byte) | Dùng key cứng trong code |
| `QR_HMAC_SECRET` | Token QR check-in | QR giả mạo |

### Khuyến nghị production

| Biến | Mô tả |
|------|--------|
| `PORT` | Mặc định `3000` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Đường dẫn file JSON service account |
| `GOOGLE_DRIVE_FOLDER_ID` | Thư mục Drive cho hợp đồng |

### Chỉ dev / CI / test

| Biến | Mô tả |
|------|--------|
| `MONGODB_URI_TEST` | Jest (`jest.setup.js`) |
| `CI` | Playwright / pipeline |

Mẫu đầy đủ: `deploy/env/.env.production.example`

## 4. Cron jobs (in-process)

| Lịch | Job | File |
|------|-----|------|
| `0 0 * * *` (00:00) | Thanh lý HĐ nợ >15 ngày; HĐ bảo lưu >12 tháng | `src/cron/cronjobs.js` |

**Lưu ý scale:** Khi >1 replica app, cron **phải** tách service (Phase 1+). Hiện tại Phase 0: **1 process** app.

## 5. External dependencies

| Dịch vụ | Dùng cho | Credential |
|---------|----------|------------|
| Google Drive API | Lưu / sync file hợp đồng | JSON service account |
| DNS registrar | A record → VPS | — |
| (Tương lai) Uptime monitor | `/health` | URL public |

## 6. Data & backup (Phase 0 policy)

| Loại | Vị trí | Backup |
|------|--------|--------|
| MongoDB data | `/var/lib/mongodb` hoặc Docker volume (Phase 1) | `mongodump` daily → off-server |
| Session | Collection Mongo `sessions` | Cùng dump Mongo |
| Uploads / static | `public/` + Drive | Drive + rsync uploads nếu có |
| `.env` / Google JSON | Server only | Encrypted copy ngoài VPS |
| Logs | PM2 / Docker / Nginx | Logrotate, giữ 7–14 ngày |

## 7. Security surface

- Session cookie: `httpOnly`, `secure` (prod), `sameSite=lax`
- Mongo: bật auth + bind localhost trước khi expose bất kỳ port nào
- Không commit: `.env`, `google-credentials.json`
- Ubuntu 18.04 → **phải** lên 22.04 (EOL)

## 8. Resource baseline (VPS hiện tại)

| Metric | Ngưỡng cảnh báo (Phase 0 quan sát) |
|--------|-------------------------------------|
| RAM | > ~85% used hoặc swap > 0 kéo dài |
| CPU load (2 core) | > 2 kéo dài lúc cao điểm |
| Disk 30GB | > 80% |
| Mongo connections | Tăng đột biến không giảm |

## 9. Sơ đồ Phase 0 (mục tiêu cuối tuần 1)

```
Internet
   → :443 Nginx (Phase 1) / tạm :3000 chỉ test nội bộ
   → Node (1 process) :3000 localhost
   → Mongo :27017 localhost
Docker: chỉ cài engine, chưa chạy stack app (Phase 1)
```

## 10. Ma trận môi trường

| | Local | Staging (sắp tới) | Production |
|---|-------|-------------------|------------|
| DB | Docker/local Mongo | DB riêng | VPS Mongo (tạm) |
| Secrets | `.env` local | `.env.staging` server | `.env.production` server |
| Domain | localhost | `staging.*` | `app.*` |
