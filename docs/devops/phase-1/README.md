# Phase 1 — Docker Compose + deploy staging/prod

**Prerequisites:** Phase 0 complete (22.04, Docker, `/opt/fitcity/env/.env.production`).

**CI/CD:** GitHub Actions — xem [github-actions.md](./github-actions.md).

## Artifacts

| Path | Purpose |
|------|---------|
| `deploy/docker/Dockerfile` | Production Node image |
| `deploy/docker/docker-compose.yml` | `mongo` + `app` + `cron` |
| `deploy/nginx/fitcity.conf` | Nginx reverse proxy (host) |
| `deploy/scripts/deploy-compose.sh` | Build & up on VPS |
| `GET /health` | App health + Mongo ping |

## Deploy on VPS (160.25.81.177)

### 1. Clone repo

```bash
sudo mkdir -p /opt/fitcity/app
sudo chown vmadmin:vmadmin /opt/fitcity/app
git clone <YOUR_REPO_URL> /opt/fitcity/app
cd /opt/fitcity/app
```

### 2. Fix line endings (if cloned from Windows)

```bash
sed -i 's/\r$//' deploy/scripts/deploy-compose.sh
chmod +x deploy/scripts/deploy-compose.sh
```

### 3. Build & start

```bash
./deploy/scripts/deploy-compose.sh
```

Or manually:

```bash
docker compose -f deploy/docker/docker-compose.yml up -d --build
docker compose -f deploy/docker/docker-compose.yml ps
curl http://127.0.0.1:3000/health
```

### 4. Nginx + TLS (host)

```bash
sudo apt install -y nginx
sudo cp deploy/nginx/fitcity.conf /etc/nginx/sites-available/fitcity
sudo nano /etc/nginx/sites-available/fitcity   # set YOUR_DOMAIN
sudo ln -sf /etc/nginx/sites-available/fitcity /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

`TRUST_PROXY=1` is set in Compose for secure cookies behind HTTPS.

### 5. Seed data (first time only)

```bash
docker compose -f deploy/docker/docker-compose.yml exec app node src/seeds/master_seed.js
```

(Adjust seed script path if needed.)

## Operations

```bash
cd /opt/fitcity/app
docker compose -f deploy/docker/docker-compose.yml logs -f app
docker compose -f deploy/docker/docker-compose.yml restart app
docker compose -f deploy/docker/docker-compose.yml pull   # after image registry (Phase 2)
```

## Architecture

```
Internet → Nginx :443 → 127.0.0.1:3000 (app)
                              ↓
                         mongo:27017 (internal network)
                         cron (same image, no HTTP)
```

## Definition of Done — Phase 1

- [ ] `docker compose ps` — app, mongo, cron healthy
- [ ] `curl http://127.0.0.1:3000/health` → `"status":"ok"`
- [ ] Nginx serves domain (HTTP/HTTPS)
- [ ] Cron container running (one replica)
- [ ] Mongo data in volume `fitcity_mongo_data`
