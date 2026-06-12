# GitHub Actions — CI/CD FitCity

Repo: `https://github.com/Interlinkjsc/Fitcity`

## Workflows

| File | Khi chạy | Việc làm |
|------|----------|----------|
| `.github/workflows/ci.yml` | PR / push `main`, `developer` | `npm ci` + `npm run test:ci` |
| `.github/workflows/deploy-production.yml` | Push `main` / manual | SSH → VPS → `git pull` → `docker compose up -d --build` |
| `.github/workflows/deploy-staging.yml` | Push `developer` / manual | Giống prod, branch `developer` |

## Secrets (GitHub → Settings → Secrets and variables → Actions)

| Secret | Ví dụ | Bắt buộc |
|--------|-------|----------|
| `VPS_HOST` | `160.25.81.177` | Có |
| `VPS_USER` | `vmadmin` | Có |
| `VPS_SSH_PRIVATE_KEY` | Nội dung file `id_ed25519` (private) | Có |
| `VPS_PORT` | `22` | Không (mặc định 22) |
| `VPS_APP_PATH` | `/opt/fitcity/app` | Không |

### Tạo SSH key cho Actions

Trên máy dev (chỉ dùng cho deploy, không phải key cá nhân):

```bash
ssh-keygen -t ed25519 -C "github-actions-fitcity" -f ./gha_fitcity_deploy
```

Trên VPS (`vmadmin`):

```bash
cat >> ~/.ssh/authorized_keys << 'EOF'
<paste nội dung gha_fitcity_deploy.pub>
EOF
chmod 600 ~/.ssh/authorized_keys
```

GitHub secret `VPS_SSH_PRIVATE_KEY` = toàn bộ file **`gha_fitcity_deploy`** (private).

## Chuẩn bị VPS (một lần)

```bash
sudo mkdir -p /opt/fitcity/app
sudo chown vmadmin:vmadmin /opt/fitcity/app
git clone https://github.com/Interlinkjsc/Fitcity.git /opt/fitcity/app
cd /opt/fitcity/app
git checkout main   # hoặc developer cho staging
```

Phase 0 env: `/opt/fitcity/env/.env.production` (đã có).

## Environments (khuyến nghị)

GitHub → Settings → Environments:

- **production** — protection: require reviewer (tuỳ chọn)
- **staging** — deploy branch `developer`

Workflow `deploy-production.yml` dùng `environment: production`.

## Luồng làm việc gợi ý

1. Làm việc trên branch **`developer`** → push → CI + **deploy staging** (cùng VPS nếu chưa tách).
2. Merge PR → **`main`** → CI + **deploy production**.

## Không dùng GHCR (giai đoạn này)

Image build **trên VPS** sau `git pull` (đơn giản, không cần registry). Phase sau có thể: build image trên Actions → push GHCR → VPS `docker pull`.

## Troubleshooting

| Lỗi | Xử lý |
|-----|--------|
| `Permission denied (publickey)` | Kiểm tra `VPS_SSH_PRIVATE_KEY`, public key trên VPS |
| `git pull` fail | Trên VPS: `git remote -v`, quyền thư mục `vmadmin` |
| Health fail | SSH vào: `docker compose -f deploy/docker/docker-compose.yml logs app` |
| CI test fail | Chạy local: `npm run test:ci` |
