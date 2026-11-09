# IDS Automate production deployment

Target: a Linux VPS with Docker Engine, Docker Compose v2, a public DNS record and ports 80/443 open. PostgreSQL and Redis stay on Docker’s internal `backend` network and are not published to the internet.

This runbook prepares a deployment; it does not claim that a real VPS, SMTP provider or Meta application has already been verified.

## 1. Server and DNS

1. Point the chosen domain’s `A`/`AAAA` record to the VPS.
2. Install Docker Engine and the Compose plugin from Docker’s official repository.
3. Clone or securely copy this repository to `/opt/ids-automate`.
4. Allow inbound TCP 22, 80 and 443 only. Do not open 5432 or 6379.

```bash
cd /opt/ids-automate
cp .env.example .env.production
chmod 600 .env.production
```

## 2. Production environment

Replace every placeholder. Keep this file out of Git and backups that are not encrypted.

```dotenv
IDS_DOMAIN=automate.example.com
POSTGRES_DB=ids_automate
POSTGRES_USER=ids
POSTGRES_PASSWORD=<long-random-database-password>

APP_ENV=production
APP_URL=https://automate.example.com
API_URL=https://automate.example.com
SESSION_SECRET=<at-least-32-random-characters>
TOKEN_ENCRYPTION_KEY=<base64-encoded-random-32-bytes>
COOKIE_SECURE=true
ALLOWED_ORIGINS=https://automate.example.com
TRUSTED_PROXY_CIDRS=172.16.0.0/12

INSTAGRAM_PROVIDER=meta
META_APP_ID=<meta-app-id>
META_APP_SECRET=<server-only-meta-app-secret>
META_API_VERSION=<supported-graph-version>
META_LOGIN_MODE=unified
META_LOGIN_CONFIG_ID=2331645327602552
META_REDIRECT_URI=https://automate.example.com/api/v1/instagram/callback
META_WEBHOOK_VERIFY_TOKEN=<random-verify-token>
META_WEBHOOK_APP_SECRET=<server-only-meta-app-secret-for-signatures>

MAIL_PROVIDER=smtp
MAIL_FROM=IDS Automate <noreply@automate.example.com>
MAIL_SMTP_HOST=<smtp-host>
MAIL_SMTP_PORT=587
MAIL_SMTP_USER=<smtp-user>
MAIL_SMTP_PASSWORD=<smtp-password>
MAIL_SMTP_STARTTLS=true

BILLING_MODE=disabled
```

Generate strong values without copying shell history into the repository:

```bash
openssl rand -base64 48
openssl rand -base64 32
openssl rand -hex 32
```

The second command produces a valid `TOKEN_ENCRYPTION_KEY`. Record secret ownership and rotation dates outside the repository. Rotating the encryption key without a token re-encryption procedure makes existing Instagram tokens unreadable.

## 3. First TLS certificate

The production Nginx configuration requires an existing certificate. Before starting Nginx, obtain the first certificate through the profiled Certbot service. Port 80 must be free.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml pull postgres redis nginx certbot
docker compose --env-file .env.production -f docker-compose.prod.yml --profile certificates run --rm --service-ports certbot certonly --standalone --non-interactive --agree-tos --email admin@example.com -d automate.example.com
```

Replace the domain and email with real values. The certificate is stored in the Compose `letsencrypt` volume and mounted read-only into Nginx.

## 4. Build and start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build --pull api web
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 api web nginx
```

The API applies forward SQL migrations at startup. Do not run the development seed command in production. The health endpoint is `https://automate.example.com/healthz`.

## 5. Meta configuration

In the same Meta app that owns Configuration ID `2331645327602552`, set:

- OAuth redirect: `https://automate.example.com/api/v1/instagram/callback`
- webhook callback: `https://automate.example.com/api/v1/webhooks/instagram`
- webhook verify token: the exact `META_WEBHOOK_VERIFY_TOKEN` value
- required Professional account assets and reviewed permissions

Follow [META_SETUP_CHECKLIST.md](./META_SETUP_CHECKLIST.md). Mock success is never evidence of real Meta delivery.

## 6. Certificate renewal

With Nginx running, Certbot can use the shared ACME webroot:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile certificates run --rm certbot renew --webroot -w /var/www/certbot
docker compose --env-file .env.production -f docker-compose.prod.yml exec nginx nginx -s reload
```

Schedule these commands with systemd timer or cron at least daily; Certbot renews only when needed. Alert on non-zero exit.

## 7. Upgrade

Back up first, then build the new immutable images and let health-gated dependencies restart. Never delete the named volumes during an upgrade.

```bash
cd /opt/ids-automate
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml build --pull api web
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 api web
```

Review SQL migrations before deploying because migrations are forward-only. If an application rollback is required after a schema change, deploy a compatible forward fix instead of deleting production data.

## 8. Backup and restore

Create an encrypted off-host PostgreSQL backup and separately protect `.env.production`. Redis is an acceleration/signal layer; PostgreSQL is the durable source of truth.

```bash
mkdir -p /opt/ids-backups
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres pg_dump -U ids -d ids_automate -Fc > /opt/ids-backups/ids_automate_$(date +%F_%H%M%S).dump
```

Restore only into an empty, explicitly selected recovery database or maintenance environment:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres createdb -U ids ids_automate_restore
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres pg_restore -U ids -d ids_automate_restore --clean --if-exists < /opt/ids-backups/<backup-file>.dump
```

Perform and document a restore drill before launch. Do not use `docker compose down -v` on production; `-v` deletes the database and certificate volumes.

## 9. Operations checklist

- Monitor container restarts, `/healthz`, HTTP 5xx, queue depth and failed webhook events.
- Alert on PostgreSQL disk usage, backup failure, certificate expiry and SMTP/Meta authentication errors.
- Keep host and container images patched.
- Rotate session/database/SMTP/Meta secrets through a documented maintenance window.
- Preserve audit logs according to the approved retention policy.
- Treat `delivery_state_unknown` as a manual reconciliation state; never blindly resend.
- Keep `BILLING_MODE=disabled` until a real payment provider is implemented.
