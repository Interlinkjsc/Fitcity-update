# Deploy artifacts (FitCity)

Thư mục chứa cấu hình triển khai **không** chứa secret thật.

```
deploy/
├── env/
│   └── .env.production.example   # Mẫu — copy ra server
├── server/
│   └── phase-0-ubuntu.sh         # Bootstrap VPS (Docker + UFW)
└── README.md
```

## Trên server (chuẩn đường dẫn)

| Path | Nội dung |
|------|----------|
| `/opt/fitcity/app` | Git clone / release |
| `/opt/fitcity/env/.env.production` | Secrets (chmod 600) |
| `/opt/fitcity/secrets/google-credentials.json` | Google service account |
| `/var/log/fitcity/` | Metric / app logs (tuỳ chọn) |

## Phase 1 (Docker)

| Path | Purpose |
|------|---------|
| `deploy/docker/Dockerfile` | App image |
| `deploy/docker/docker-compose.yml` | mongo + app + cron |
| `deploy/nginx/fitcity.conf` | Nginx template |
| `deploy/scripts/deploy-compose.sh` | Deploy script |
| `docs/devops/phase-1/README.md` | Hướng dẫn chi tiết |

```bash
cd /opt/fitcity/app
./deploy/scripts/deploy-compose.sh
```

## GitHub Actions

| Workflow | Trigger |
|----------|---------|
| `ci.yml` | PR / push |
| `deploy-production.yml` | push `main` |
| `deploy-staging.yml` | push `developer` |

Cấu hình secrets: [docs/devops/phase-1/github-actions.md](../docs/devops/phase-1/github-actions.md).
