# MAINSPRING — Multi-device sync (Phase 9, optional)

Status: **scaffold / experimental.** This directory stands up the *server* half of
optional multi-device sync — self-hosted Postgres + ElectricSQL — so a second
device can mirror your data. It is **opt-in and isolated**: the desktop app works
fully offline without it, and removing it changes nothing about the local data
model (DATA_LAYER §4).

Because MAINSPRING is single-user, this path **skips CRDTs and conflict
resolution entirely** — there are no concurrent multi-user edits to reconcile.

## What's here

- `docker-compose.yml` — Postgres (with `wal_level=logical`) + ElectricSQL.

## What's NOT here yet (the honest part)

This is server scaffolding only. To make sync actually work you still need:

1. **Schema on the server** — apply the Drizzle migrations from
   `packages/schema/drizzle` to this Postgres (`drizzle-kit migrate` against
   `DATABASE_URL`). The schema is identical to local PGlite — that's the whole
   point of choosing PGlite.
2. **Client read-sync** — wire ElectricSQL "shapes" into the app's PGlite so the
   server streams changes down. A thin write path sends local writes up.
3. **TLS + auth** — `ELECTRIC_INSECURE` is dev-only; front Electric with a
   reverse proxy (Caddy/Traefik) and an auth gateway before exposing it.
4. **Verification** — none of this has been run end-to-end here (it needs a real
   host + a second device). Pin image versions and validate against the current
   ElectricSQL docs before trusting it.

## Run (local trial)

```bash
cd infra/sync
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" > .env
docker compose up -d
# then apply packages/schema migrations against postgres://…:5432/mainspring
```

Cost target: one small VPS (Hetzner CX22, ~€4–5/mo). See `docs/COSTS.md`.
