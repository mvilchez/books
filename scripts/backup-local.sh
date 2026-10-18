#!/usr/bin/env bash
#
# scripts/backup-local.sh
#
# One-shot backup of the Books reading-tracker MariaDB database to a local
# folder. Writes a timestamped SQL dump (optionally gzipped) under
# db/backups/. See PLAN.md, Phase 4 (local dev loop / pre-deploy safety net).
#
# Prerequisites: mysqldump (or mariadb-dump), gzip (optional)
#
# Usage:
#   DATABASE_URL="mysql://user:pass@127.0.0.1:3306/reading_tracker_local" \
#     ./scripts/backup-local.sh
#
#   # or with defaults from DATABASE_URL / .env
#   ./scripts/backup-local.sh
#
set -euo pipefail

###############################################################################
# Configuration
###############################################################################
BACKUP_DIR="${BACKUP_DIR:-db/backups}"
KEEP_COUNT="${KEEP_COUNT:-10}"
COMPRESS="${COMPRESS:-1}"
DB_URL="${DATABASE_URL:-}"

if [[ -z "$DB_URL" ]]; then
  echo "Error: DATABASE_URL is not set (export it or source .env)." >&2
  echo "Example: DATABASE_URL=\"mysql://book:password@127.0.0.1:3306/reading_tracker_local\" $0" >&2
  exit 1
fi

if [[ ! "$DB_URL" == mysql://* ]]; then
  echo "Error: DATABASE_URL must start with mysql://" >&2
  exit 1
fi

###############################################################################
# Helpers
###############################################################################
have() { command -v "$1" >/dev/null 2>&1; }

# parse_mysql_url <url> -> prints user password host port dbname (tab separated)
parse_mysql_url() {
  local url="${1#mysql://}"
  local userpass="${url%%@*}"
  local rest="${url#*@}"
  local hostport="${rest%%/*}"
  local dbpart="${rest#*/}"
  local dbname="${dbpart%%\?*}"
  local user="${userpass%%:*}"
  local pass="${userpass#*:}"
  [[ "$pass" == "$userpass" ]] && pass=""
  local host="${hostport%%:*}"
  local port="${hostport#*:}"
  [[ "$port" == "$hostport" ]] && port="3306"
  port="${port%%/*}"
  printf '%s\t%s\t%s\t%s\t%s\n' "$user" "$pass" "$host" "$port" "$dbname"
}

###############################################################################
# Prerequisites
###############################################################################
DUMP_TOOL=""
if have mysqldump; then DUMP_TOOL="mysqldump"; elif have mariadb-dump; then DUMP_TOOL="mariadb-dump"; fi
if [[ -z "$DUMP_TOOL" ]]; then
  echo "Error: neither mysqldump nor mariadb-dump is installed." >&2
  exit 1
fi
echo "==> Using dump tool: $DUMP_TOOL"

###############################################################################
# Parse connection info
###############################################################################
IFS=$'\t' read -r MYSQL_USER MYSQL_PASS MYSQL_HOST MYSQL_PORT MYSQL_NAME < <(parse_mysql_url "$DB_URL")
export MYSQL_PWD="$MYSQL_PASS"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BASE_NAME="reading_tracker_${TIMESTAMP}"
SQL_FILE="$BACKUP_DIR/${BASE_NAME}.sql"

###############################################################################
# Dump
###############################################################################
echo "==> Backing up MariaDB database '$MYSQL_NAME' at $MYSQL_HOST:$MYSQL_PORT"
"$DUMP_TOOL" \
  --host="$MYSQL_HOST" \
  --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --skip-add-locks \
  --skip-add-drop-table \
  --skip-comments \
  "$MYSQL_NAME" \
  > "$SQL_FILE"

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

###############################################################################
# Rotate old backups (keep the KEEP_COUNT most recent)
###############################################################################
echo "==> Rotating backups (keeping newest $KEEP_COUNT)"
mapfile -t ALL_BACKUPS < <(ls -1 "$BACKUP_DIR"/reading_tracker_*.sql* 2>/dev/null | sort -r)
if [[ "${#ALL_BACKUPS[@]}" -gt "$KEEP_COUNT" ]]; then
  for old in "${ALL_BACKUPS[@]:$KEEP_COUNT}"; do
    rm -f -- "$old"
    echo "   removed: $old"
  done
else
  echo "   nothing to rotate (${#ALL_BACKUPS[@]} backups present)"
fi

echo "==> Backup complete."
