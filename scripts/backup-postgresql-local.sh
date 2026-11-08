#!/usr/bin/env bash
#
# scripts/backup-postgresql-local.sh
#
# Back up a PostgreSQL database (NeonDB by default) and restore it into a
# local PostgreSQL database. Reverse of backup-to-postgresql.sh.
#
set -euo pipefail

# shellcheck source=./pg-backup-common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pg-backup-common.sh"

BACKUP_DIR="${BACKUP_DIR:-db/backups}"
KEEP_COUNT="${KEEP_COUNT:-10}"
COMPRESS="${COMPRESS:-1}"

if [[ -z "${PG_SOURCE_URL:-}" ]]; then
  if [[ -n "${SOURCE_DATABASE_URL:-}" ]]; then PG_SOURCE_URL="$SOURCE_DATABASE_URL"
  elif [[ -n "${POSTGRES_URL:-}" ]]; then PG_SOURCE_URL="$POSTGRES_URL"
  elif [[ -n "${DATABASE_URL:-}" ]]; then PG_SOURCE_URL="$DATABASE_URL"
  elif [[ -f ".env.production" ]]; then
    val="$(grep -E '^POSTGRES_URL=' .env.production 2>/dev/null | head -1 | sed -E 's/^POSTGRES_URL=//; s/^"//; s/"$//')"
    [[ -n "$val" ]] && PG_SOURCE_URL="$val"
  fi
fi

if [[ -z "${PG_TARGET_URL:-}" ]]; then
  if [[ -n "${LOCAL_POSTGRES_URL:-}" ]]; then PG_TARGET_URL="$LOCAL_POSTGRES_URL"
  elif [[ -n "${LOCAL_DATABASE_URL:-}" ]]; then PG_TARGET_URL="$LOCAL_DATABASE_URL"
  elif [[ -f ".env.local" ]]; then
    val="$(grep -E '^DATABASE_URL=' .env.local 2>/dev/null | head -1 | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')"
    [[ -n "$val" ]] && PG_TARGET_URL="$val"
  else PG_TARGET_URL="postgresql://book:password@127.0.0.1:5432/reading_tracker_local"
  fi
fi

if [[ -z "${PG_SOURCE_URL:-}" ]]; then
  echo "Error: could not resolve a source PostgreSQL URL." >&2
  exit 1
fi
if [[ ! "$PG_SOURCE_URL" == postgresql://* && ! "$PG_SOURCE_URL" == postgres://* ]]; then
  echo "Error: PG_SOURCE_URL must start with postgresql://" >&2
  exit 1
fi
if [[ ! "$PG_TARGET_URL" == postgresql://* && ! "$PG_TARGET_URL" == postgres://* ]]; then
  echo "Error: PG_TARGET_URL must start with postgresql://" >&2
  exit 1
fi

have() { command -v "$1" >/dev/null 2>&1; }
for tool in pg_dump psql; do
  have "$tool" || { echo "Error: $tool is not installed." >&2; exit 1; }
done

IFS=$'\t' read -r SRC_USER SRC_PASS SRC_HOST SRC_PORT SRC_NAME SRC_QUERY < <(parse_pg_url "$PG_SOURCE_URL")
IFS=$'\t' read -r TGT_USER TGT_PASS TGT_HOST TGT_PORT TGT_NAME TGT_QUERY < <(parse_pg_url "$PG_TARGET_URL")

run_src() { run_pg "$PG_SOURCE_URL" "$@"; }
run_tgt() { run_pg "$PG_TARGET_URL" "$@"; }

# connection argument arrays (avoid putting secrets in argv where possible;
# passwords are passed via PGPASSWORD)
src_conn=(--host="$SRC_HOST" --port="$SRC_PORT" --username="$SRC_USER" --dbname="$SRC_NAME")
tgt_conn=(--host="$TGT_HOST" --port="$TGT_PORT" --username="$TGT_USER" --dbname="$TGT_NAME")

echo "==> Ensuring target database '$TGT_NAME' exists at $TGT_HOST:$TGT_PORT"
if ! run_tgt psql "${tgt_conn[@]}" -c 'SELECT 1' >/dev/null 2>&1; then
  if have createdb; then
    echo "   Target database not reachable; attempting to create it."
    if ! run_tgt createdb --host="$TGT_HOST" --port="$TGT_PORT" --username="$TGT_USER" "$TGT_NAME" 2>/dev/null; then
      echo "Error: could not create target database '$TGT_NAME'." >&2
      exit 1
    fi
  else
    echo "Error: target database '$TGT_NAME' is not reachable and 'createdb' is not installed." >&2
    exit 1
  fi
fi
echo "   Target database reachable"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BASE_NAME="reading_tracker_postgresql_${TIMESTAMP}"
SQL_FILE="$BACKUP_DIR/${BASE_NAME}.sql"

echo "==> Dumping source PostgreSQL database '$SRC_NAME' at $SRC_HOST:$SRC_PORT"
pg_dump_to_file "$PG_SOURCE_URL" "$SQL_FILE"
if [[ ! -s "$SQL_FILE" ]]; then
  echo "Warning: pg_dump produced empty file." >&2
  echo "  Ensure pg_dump version matches server (Neon has PG 18)." >&2
  echo "  Or manually download a dump from Neon console: https://console.neon.tech" >&2
  rm -f "$SQL_FILE"
  exit 1
fi

if [[ ! -s "$SQL_FILE" ]]; then
  echo "Error: dump produced an empty file." >&2
  rm -f "$SQL_FILE"
  exit 1
fi

FINAL_FILE="$SQL_FILE"
if [[ "$COMPRESS" == "1" && -n "$(command -v gzip)" ]]; then
  gzip -f "$SQL_FILE"
  FINAL_FILE="$SQL_FILE.gz"
fi

SIZE="$(du -h "$FINAL_FILE" | cut -f1)"
echo "==> Backup written: $FINAL_FILE ($SIZE)"

echo "==> Restoring into local PostgreSQL database '$TGT_NAME'"
if [[ "$FINAL_FILE" == *.gz ]]; then
  gunzip -c "$FINAL_FILE" | sed '/^SET transaction_timeout = /d' | run_tgt psql "${tgt_conn[@]}" -v ON_ERROR_STOP=1
else
  sed '/^SET transaction_timeout = /d' "$FINAL_FILE" | run_tgt psql "${tgt_conn[@]}" -v ON_ERROR_STOP=1
fi
echo "   Restore complete"

echo "==> Verifying row counts"
TABLES=(Author Genre Tag Book book_tags book_metadata_candidates)
ALL_OK=1
for table in "${TABLES[@]}"; do
  src_count="$(run_src psql "${src_conn[@]}" -t -A -c "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null | tr -d '[:space:]')"
  tgt_count="$(run_tgt psql "${tgt_conn[@]}" -t -A -c "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null | tr -d '[:space:]')"
  [[ -z "$src_count" ]] && src_count="?"
  [[ -z "$tgt_count" ]] && tgt_count="?"
  if [[ "$src_count" == "$tgt_count" && "$src_count" != "?" ]]; then
    status="OK"
  else
    status="MISMATCH"
    ALL_OK=0
  fi
  printf '   %-26s source=%s local=%s [%s]\n' "$table" "$src_count" "$tgt_count" "$status"
done

if [[ "$ALL_OK" -eq 1 ]]; then
  echo "==> All table counts match. Local PostgreSQL is up to date."
else
  echo "==> WARNING: some counts differ." >&2
  exit 1
fi

echo "==> Rotating backups (keeping newest $KEEP_COUNT)"
rotate_backups "$BACKUP_DIR" "reading_tracker_postgresql" "$KEEP_COUNT"

echo "==> Backup + restore complete."
echo "   Point the app at the local database with:"
echo "     npm run switch-db local-postgres"
echo "   or set DATABASE_URL=\"$PG_TARGET_URL\" in .env"
