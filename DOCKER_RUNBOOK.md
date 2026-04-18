# Docker Deployment Runbook

Spin up a production-grade stack (Next.js app + MongoDB) on any machine with
Docker 24+ and Docker Compose v2.

## 1. Prerequisites

- Docker 24+ (`docker --version`)
- Docker Compose v2 (`docker compose version` — space, not dash)
- ~2 GB free disk
- Outbound network access for the build step (npm + Supabase + Stripe)

## 2. Copy + configure env

```bash
cp .env.docker.example .env.docker
# open .env.docker in your editor and replace every placeholder
```

The critical ones:

| Variable                         | Where to get it                                     |
|----------------------------------|-----------------------------------------------------|
| `NEXT_PUBLIC_BASE_URL`           | the URL users will hit (e.g. `http://192.168.1.10:3000`) |
| `MONGO_ROOT_PASSWORD`            | generate with `openssl rand -base64 32`             |
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase dashboard → API → Project URL              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase dashboard → API → anon public key          |
| `SUPABASE_SERVICE_ROLE_KEY`      | Supabase dashboard → API → service_role secret      |
| `STRIPE_SECRET_KEY`              | Stripe dashboard → Developers → API keys            |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | same place, publishable key                     |
| `CRON_SECRET`                    | generate with `openssl rand -hex 32`                |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | whatever you want the first admin to be |

## 3. Bring it up

```bash
docker compose --env-file .env.docker up -d --build
```

First run takes ~3–5 minutes (npm install + Next build inside the image).

Confirm both containers are healthy:

```bash
docker compose --env-file .env.docker ps
```

Both should say `Up` and eventually `healthy`. Hit
`http://<host-ip>:${WEB_PORT:-3000}/api/health` — expected response is
`{"status":"ok"}`.

## 4. Tail logs while testing

```bash
docker compose --env-file .env.docker logs -f web
# or
docker compose --env-file .env.docker logs -f mongo
```

## 5. Stop / restart / upgrade

```bash
# stop
docker compose --env-file .env.docker down

# restart the app without rebuilding (e.g. after changing .env.docker)
docker compose --env-file .env.docker up -d

# rebuild after a code change
docker compose --env-file .env.docker up -d --build web

# wipe EVERYTHING including the database volume — destructive
docker compose --env-file .env.docker down -v
```

## 6. Backups

The MongoDB data lives in the named volume `apartment-finder_mongo-data`.
Back it up with:

```bash
docker run --rm \
  -v apartment-finder_mongo-data:/data/db:ro \
  -v "$(pwd)/backups":/backup \
  mongo:7 \
  sh -c "mongodump --uri='mongodb://<user>:<pass>@host.docker.internal:27017/apartmentfinder?authSource=admin' --archive=/backup/apartmentfinder-$(date +%F).archive"
```

## 7. Opening the DB port to the LAN (optional)

By default Mongo only listens on `127.0.0.1:27017`. If you need MongoDB
Compass or another tool on a different machine, edit `docker-compose.yml`:

```yaml
    ports:
      - "27017:27017"   # was "127.0.0.1:27017:27017"
```

Then `docker compose --env-file .env.docker up -d`.

## 8. Common gotchas

- **Port 3000 already in use** → set `WEB_PORT=3001` in `.env.docker`.
- **Can't reach the app from another machine** → Docker binds to `0.0.0.0`
  already; the issue is almost always a host firewall. On Linux:
  `sudo ufw allow 3000/tcp`.
- **Supabase auth fails** → make sure `NEXT_PUBLIC_BASE_URL` is in the
  Supabase project → Authentication → URL Configuration → Redirect URLs.
- **Emails aren't sending** → you probably left `RESEND_API_KEY` blank; that's
  fine for dev, but the app just logs mail instead of sending it.
- **KYC webhook isn't firing** → Stripe webhooks need a publicly-reachable
  URL. Use a tunnel (ngrok, cloudflared) if the host isn't on the public
  internet.
