#!/usr/bin/env bash
#
# scripts/backup-cloud-local.sh
# One-shot backup of the remote (Neon) PostgreSQL database to db/backups/.
#
# Writes db/backups/reading_tracker_cloud_YYYYMMDD_HHMMSS.sql[.gz] and keeps
# the newest KEEP_COUNT backups (override with KEEP_COUNT). Set COMPRESS=0 to
# skip gzip. Read-only for the source database; safe to run before deploys.
#
# Source URL resolution:
#   PG_SOURCE_URL > NEON_DB_URL > POSTGRES_URL > DATABASE_URL >
#   .env.production (POSTGRES_URL) > .env (DATABASE_URL)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./pg-backup-common.sh
. "$SCRIPT_DIR/pg-backup-common.sh"

BACKUP_DIR="${BACKUP_DIR:-db/backups}"
KEEP_COUNT="${KEEP_COUNT:-10}"
COMPRESS="${COMPRESS:-1}"

resolve_neon_url() {
  if [[ -n "${PG_SOURCE_URL:-}" ]]; then printf '%s' "$PG_SOURCE_URL"; return 0; fi
  if [[ -n "${NEON_DB_URL:-}" ]]; then printf '%s' "$NEON_DB_URL"; return 0; fi
  if [[ -n "${POSTGRES_URL:-}" ]]; then printf '%s' "$POSTGRES_URL"; return 0; fi
  if [[ -n "${DATABASE_URL:-}" ]]; then printf '%s' "$DATABASE_URL"; return 0; fi
  if [[ -f .env.production ]]; then
    local val
    val="$(grep -E '^POSTGRES_URL=' .env.production 2>/dev/null | head -1 | sed -E 's/^POSTGRES_URL=//; s/^"//; s/"$//')"
    [[ -n "$val" ]] && { printf '%s' "$val"; return 0; }
  fi
  if [[ -f .env ]]; then
    local val
    val="$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')"
    [[ -n "$val" ]] && { printf '%s' "$val"; return 0; }
  fi
  return 1
}

PG_SOURCE_URL="$(resolve_neon_url || true)"
if [[ -z "$PG_SOURCE_URL" ]]; then
  echo "Error: could not resolve a remote (Neon) PostgreSQL URL." >&2
  echo "   Set PG_SOURCE_URL / NEON_DB_URL / POSTGRES_URL / DATABASE_URL," >&2
  echo "   or add POSTGRES_URL to .env.production." >&2
  exit 1
fi

[[ "$PG_SOURCE_URL" == postgresql://* || "$PG_SOURCE_URL" == postgres://* ]] || {
  echo "Error: PG_SOURCE_URL must start with postgresql://" >&2
  exit 1
}

for tool in pg_dump gzip; do
  have "$tool" || { echo "Error: $tool is not installed." >&2; exit 1; }
done

IFS=$'\t' read -r SRC_USER SRC_PASS SRC_HOST SRC_PORT SRC_NAME SRC_QUERY < <(parse_pg_url "$PG_SOURCE_URL")

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BASE_NAME="reading_tracker_cloud_${TIMESTAMP}"
SQL_FILE="$BACKUP_DIR/${BASE_NAME}.sql"

echo "==> Dumping remote (Neon) PostgreSQL database '$SRC_NAME' at $SRC_HOST:$SRC_PORT"
pg_dump_to_file "$PG_SOURCE_URL" "$SQL_FILE"

if [[ ! -s "$SQL_FILE" ]]; then
  echo "Error: dump produced an empty file." >&2
  rm -f "$SQL_FILE"
  exit 1
fi

FINAL_FILE="$SQL_FILE"
if [[ "$COMPRESS" == "1" ]]; then
  gzip -f "$SQL_FILE"
  FINAL_FILE="$SQL_FILE.gz"
fi

SIZE="$(du -h "$FINAL_FILE" | cut -f1)"
echo "==> Backup written: $FINAL_FILE ($SIZE)"

echo "==> Rotating backups (keeping newest $KEEP_COUNT)"
rotate_backups "$BACKUP_DIR" "reading_tracker_cloud" "$KEEP_COUNT"

echo "==> Remote (Neon) backup complete."
