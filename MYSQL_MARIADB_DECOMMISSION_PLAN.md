# MySQL / MariaDB Decommission Plan

Status: **Planned (not executed)** — the application already runs on PostgreSQL
(Neon) in development, but MariaDB scripts, schema, and documentation are still
present. This plan removes them once a local PostgreSQL workflow is in place.

## Goals

- Make PostgreSQL the only supported database (local dev + production).
- Retire MariaDB/SkySQL-specific scripts, schema, and connection paths.
- Preserve a recoverable MariaDB backup for a grace period.

## Prerequisites (already available)

- `scripts/backup-postgresql-local.sh` (npm: `backup:postgresql:local`) syncs a
  remote PostgreSQL database into the local PostgreSQL instance.
- Local PostgreSQL URL: `postgresql://book:password@127.0.0.1:5432/reading_tracker_local`
- `npm run switch-db local-postgres` points `.env` at the local PostgreSQL URL.
- `prisma/schema.prisma` uses `provider = "postgresql"`.

## Phase 1 — Prepare local PostgreSQL

1. Install/start a local PostgreSQL 16 instance and create a `book` role +
   `reading_tracker_local` database.
2. Apply the schema: `npm run switch-db local-postgres && npx prisma db push`.
3. Seed from production/Neon: `npm run backup:postgresql:local`.
4. Verify the app: `npm run dev` (browse a few years, stats, tags).

## Phase 2 — Switch all environments to PostgreSQL

1. Update `.env` to the local PostgreSQL URL (via `switch-db local-postgres`).
2. Update `.env.production` registry: remove/comment `DATABASE_URL` (MariaDB)
   and keep `POSTGRES_URL` (Neon) as the production target.
3. Update `.env.example` default to the PostgreSQL URL (commented MariaDB line
   can be removed once Phase 4 completes).
4. Run `npm run switch-db status` and confirm provider = `postgresql`.

## Phase 3 — Remove MariaDB-only code and docs

- Delete scripts: `backup-local.sh`, `backup-cloud-local.sh`,
  `backup-to-postgresql.sh`, `connect-skysql.sh`.
- Remove npm scripts: `backup:local`, `backup:cloud-local`, `backup:postgresql`.
- Remove `db/schema.sql` (MariaDB) or replace with a PostgreSQL-flavored schema.
- Remove MariaDB-specific sections from `README.md` and `PLAN.md`.
- Update `scripts/switch-db.sh`: drop `local`/`cloud`/`mariadb` targets (or keep
  `cloud` only if a managed MariaDB fallback is still desired).
- Remove `prisma/migrations/migration_lock.toml` and old `mysql` migrations if
  still present.

## Phase 4 — Final cutover and cleanup

1. Take a final MariaDB backup: `npm run backup:cloud-local` (keep off-site).
2. Run the PostgreSQL backup/restore once more and verify row counts.
3. Run validation: `npm test`, `npm run lint`, `npm run build`.
4. Drop the MariaDB database/user and revoke SkySQL access after a grace period
   (recommended: 30 days).
5. Remove MariaDB client packages from developer setup docs.

## Rollback

- Restore the retained MariaDB dump with the `mariadb` client.
- Re-add `DATABASE_URL` (MariaDB) to `.env` / `.env.production`.
- Run `npm run switch-db cloud` (or `local`) and `npx prisma db push`.

## Validation checklist

- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds with a PostgreSQL `DATABASE_URL`
- [ ] Row counts match between source and local PostgreSQL
- [ ] App smoke test (dashboard, stats, tags, book edit) passes on local PostgreSQL
