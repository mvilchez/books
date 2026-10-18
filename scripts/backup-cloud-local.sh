#!/usr/bin/env bash
#
# scripts/backup-cloud-local.sh
#
# Dump a MariaDB cloud instance (SkySQL / Aiven / any managed MariaDB) to a
# local SQL file. Reuses the connection pattern from scripts/connect-skysql.sh
# and the dump logic from scripts/backup-local.sh.
#
# Read-only for the cloud database: it never issues writes, inserts, or drops
# against the source. Writes a timestamped (optionally gzipped) dump under
# db/backups/.
#
# Prerequisites: mysqldump (or mariadb-dump), gzip (optional)
#
# Connection (any of these):
#   CLOUD_DB_URL="mysql://USER:PASS@HOST:PORT/DB?sslaccept=strict"   (preferred)
#   or individual vars: CLOUD_DB_HOST, CLOUD_DB_PORT, CLOUD_DB_USER,
#   CLOUD_DB_PASSWORD, CLOUD_DB_NAME
#   or defaults matching scripts/connect-skysql.sh (SkySQL):
#     host serverless-us-east1.sysp0000.db2.skysql.com, port 4014,
#     user dbpgf14648016, database reading_tracker
#
# Usage:
#   CLOUD_DB_URL="mysql://dbpgf14648016:PASS@serverless-us-east1.sysp0000.db2.skysql.com:4014/reading_tracker?sslaccept=strict" \
#     ./scripts/backup-cloud-local.sh
#
#   # or with individual vars:
#   CLOUD_DB_HOST=... CLOUD_DB_PORT=4014 CLOUD_DB_USER=... CLOUD_DB_PASSWORD=... CLOUD_DB_NAME=reading_tracker \
#     ./scripts/backup-cloud-local.sh
#
set -euo pipefail

###############################################################################
# Configuration
###############################################################################
BACKUP_DIR="${BACKUP_DIR:-db/backups}"
KEEP_COUNT="${KEEP_COUNT:-10}"
COMPRESS="${COMPRESS:-1}"
CLOUD_DB_URL="${CLOUD_DB_URL:-}"

# SkySQL defaults (mirrors scripts/connect-skysql.sh)
DEFAULT_HOST="serverless-us-east1.sysp0000.db2.skysql.com"
DEFAULT_PORT="4014"
DEFAULT_USER="dbpgf14648016"
DEFAULT_NAME="reading_tracker"

CLOUD_DB_HOST="${CLOUD_DB_HOST:-$DEFAULT_HOST}"
CLOUD_DB_PORT="${CLOUD_DB_PORT:-$DEFAULT_PORT}"
CLOUD_DB_USER="${CLOUD_DB_USER:-$DEFAULT_USER}"
CLOUD_DB_PASSWORD="${CLOUD_DB_PASSWORD:-}"
CLOUD_DB_NAME="${CLOUD_DB_NAME:-$DEFAULT_NAME}"

if [[ -n "$CLOUD_DB_URL" ]]; then
  if [[ ! "$CLOUD_DB_URL" == mysql://* ]]; then
    echo "Error: CLOUD_DB_URL must start with mysql://" >&2
    exit 1
  fi
  # Parse mysql://user:pass@host:port/dbname?params
  url="${CLOUD_DB_URL#mysql://}"
  userpass="${url%%@*}"
  rest="${url#*@}"
  hostport="${rest%%/*}"
  dbpart="${rest#*/}"
  dbname="${dbpart%%\?*}"
  user="${userpass%%:*}"
  pass="${userpass#*:}"
  [[ "$pass" == "$userpass" ]] && pass=""
  host="${hostport%%:*}"
  port="${hostport#*:}"
  [[ "$port" == "$hostport" ]] && port="3306"
  port="${port%%/*}"
  CLOUD_DB_USER="$user"
  CLOUD_DB_PASSWORD="$pass"
  CLOUD_DB_HOST="$host"
  CLOUD_DB_PORT="$port"
  CLOUD_DB_NAME="$dbname"
fi

if [[ -z "$CLOUD_DB_PASSWORD" ]]; then
  echo "Error: CLOUD_DB_PASSWORD is not set (provide it via CLOUD_DB_URL or CLOUD_DB_PASSWORD)." >&2
  echo "The cloud password must never be hard-coded in this script." >&2
  exit 1
fi

###############################################################################
# Helpers
###############################################################################
have() { command -v "$1" >/dev/null 2>&1; }

###############################################################################
# Prerequisites
###############################################################################
echo "==> Checking prerequisites"
DUMP_TOOL=""
if have mysqldump; then DUMP_TOOL="mysqldump"; elif have mariadb-dump; then DUMP_TOOL="mariadb-dump"; fi
if [[ -z "$DUMP_TOOL" ]]; then
  echo "Error: neither mysqldump nor mariadb-dump is installed." >&2
  exit 1
fi
echo "   dump tool: $DUMP_TOOL"

export MYSQL_PWD="$CLOUD_DB_PASSWORD"

###############################################################################
# Connectivity check
###############################################################################
echo "==> Checking connectivity to MariaDB cloud ($CLOUD_DB_HOST:$CLOUD_DB_PORT)"
mariadb --host="$CLOUD_DB_HOST" --port="$CLOUD_DB_PORT" --user="$CLOUD_DB_USER" --no-password "$CLOUD_DB_NAME" \
  -e "SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema = DATABASE();" >/dev/null
echo "   Cloud database '$CLOUD_DB_NAME' reachable"

###############################################################################
# Dump
###############################################################################
mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BASE_NAME="reading_tracker_cloud_${TIMESTAMP}"
SQL_FILE="$BACKUP_DIR/${BASE_NAME}.sql"

echo "==> Dumping cloud database '$CLOUD_DB_NAME' to $SQL_FILE"
"$DUMP_TOOL" \
  --host="$CLOUD_DB_HOST" \
  --port="$CLOUD_DB_PORT" \
  --user="$CLOUD_DB_USER" \
  --no-password \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --skip-add-locks \
  --skip-add-drop-table \
  --skip-comments \
  "$CLOUD_DB_NAME" \
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
echo "==> Cloud backup written: $FINAL_FILE ($SIZE)"

###############################################################################
# Rotate old backups
###############################################################################
echo "==> Rotating backups (keeping newest $KEEP_COUNT)"
mapfile -t ALL_BACKUPS < <(ls -1 "$BACKUP_DIR"/reading_tracker_cloud_*.sql* 2>/dev/null | sort -r)
if [[ "${#ALL_BACKUPS[@]}" -gt "$KEEP_COUNT" ]]; then
  for old in "${ALL_BACKUPS[@]:$KEEP_COUNT}"; do
    rm -f -- "$old"
    echo "   removed: $old"
  done
else
  echo "   nothing to rotate (${#ALL_BACKUPS[@]} backups present)"
fi

echo "==> Cloud backup complete."
