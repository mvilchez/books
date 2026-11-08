#!/usr/bin/env bash
#
# scripts/backup-local.sh
# One-shot backup of the LOCAL PostgreSQL database to db/backups/.
#
# Writes db/backups/reading_tracker_local_YYYYMMDD_HHMMSS.sql[.gz] and keeps
# the newest KEEP_COUNT backups (override with KEEP_COUNT). Set COMPRESS=0 to
# skip gzip. Read-only for the source database; safe to run before schema
# changes or deploys.
#
# Source URL resolution:
#   PG_SOURCE_URL > LOCAL_POSTGRES_URL > LOCAL_DATABASE_URL >
#   postgresql://book:password@127.0.0.1:5432/reading_tracker_local
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./pg-backup-common.sh
. "$SCRIPT_DIR/pg-backup-common.sh"

BACKUP_DIR="${BACKUP_DIR:-db/backups}"
KEEP_COUNT="${KEEP_COUNT:-10}"
COMPRESS="${COMPRESS:-1}"

PG_SOURCE_URL="${PG_SOURCE_URL:-${LOCAL_POSTGRES_URL:-${LOCAL_DATABASE_URL:-postgresql://book:password@127.0.0.1:5432/reading_tracker_local}}}"

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
BASE_NAME="reading_tracker_local_${TIMESTAMP}"
SQL_FILE="$BACKUP_DIR/${BASE_NAME}.sql"

echo "==> Dumping local PostgreSQL database '$SRC_NAME' at $SRC_HOST:$SRC_PORT"
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
rotate_backups "$BACKUP_DIR" "reading_tracker_local" "$KEEP_COUNT"

echo "==> Local backup complete."
echo "   Restore into the local database with:"
echo "     gunzip -c $FINAL_FILE | PGPASSWORD=password psql \"$PG_SOURCE_URL\" -v ON_ERROR_STOP=1"
