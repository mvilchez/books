#!/usr/bin/env bash
#
# scripts/backup-to-postgresql.sh
#
# One-way migration of the Books reading-tracker ledger from MariaDB
# (local workstation or SkySQL) to PostgreSQL (Neon DB, Aiven PostgreSQL,
# or any managed Postgres). See PLAN.md, Phase 4, Step 4.4.
#
# It is READ-ONLY for MariaDB: it never issues writes, inserts, or drops
# against the source database. The PostgreSQL target is loaded into, so back
# it up before running.
#
# Prerequisites: mysqldump (or mariadb-dump), psql, npx prisma
#
# Usage:
#   MARIADB_URL="mysql://user:pass@127.0.0.1:3306/reading_tracker_local" \
#   PG_DATABASE_URL="postgresql://user:pass@host.region.neon.tech/db?sslmode=require&pgbouncer=true&connection_limit=1" \
#   ./scripts/backup-to-postgresql.sh
#
set -euo pipefail

###############################################################################
# Configuration
###############################################################################
MARIADB_URL="${MARIADB_URL:-${DATABASE_URL:-}}"
PG_DATABASE_URL="${PG_DATABASE_URL:-}"
PRISMA_SCHEMA="${PRISMA_SCHEMA:-prisma/schema.prisma}"
KEEP_DUMP="${KEEP_DUMP:-0}"

if [[ -z "$MARIADB_URL" || -z "$PG_DATABASE_URL" ]]; then
  echo "Error: set MARIADB_URL (mysql://...) and PG_DATABASE_URL (postgresql://...)" >&2
  echo "Example:" >&2
  echo "  MARIADB_URL=\"mysql://book:password@127.0.0.1:3306/reading_tracker_local\" \\" >&2
  echo "  PG_DATABASE_URL=\"postgresql://user:pass@host/db?sslmode=require\" \\" >&2
  echo "  $0" >&2
  exit 1
fi

if [[ ! "$MARIADB_URL" == mysql://* ]]; then
  echo "Error: MARIADB_URL must start with mysql://" >&2
  exit 1
fi
if [[ ! "$PG_DATABASE_URL" == postgresql://* ]]; then
  echo "Error: PG_DATABASE_URL must start with postgresql://" >&2
  exit 1
fi

###############################################################################
# Helpers
###############################################################################
have() { command -v "$1" >/dev/null 2>&1; }

# parse_mysql_url <url>  ->  prints user, password, host, port, dbname (tab separated)
parse_mysql_url() {
  local url="${1#mysql://}"
  local userpass="${url%%@*}"
  local rest="${url#*@}"
  local hostport="${rest%%/*}"
  local dbpart="${rest#*/}"
  local dbname="${dbpart%%\?*}"
  local user="${userpass%%:*}"
  local pass="${userpass#*:}"
  [[ "$pass" == "$userpass" ]] && pass=""   # no password in URL
  local host="${hostport%%:*}"
  local port="${hostport#*:}"
  [[ "$port" == "$hostport" ]] && port="3306"
  port="${port%%/*}"
  printf '%s\t%s\t%s\t%s\t%s\n' "$user" "$pass" "$host" "$port" "$dbname"
}

# parse_pg_user_pass <url> -> prints user \t password
parse_pg_user_pass() {
  local url="${1#postgresql://}"
  local userpass="${url%%@*}"
  local user="${userpass%%:*}"
  local pass="${userpass#*:}"
  [[ "$pass" == "$userpass" ]] && pass=""
  printf '%s\t%s\n' "$user" "$pass"
}

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
have psql || { echo "Error: psql (PostgreSQL client) is not installed." >&2; exit 1; }
have npx || { echo "Error: npx is not installed." >&2; exit 1; }
echo "   dump tool: $DUMP_TOOL"

###############################################################################
# Parse connection info
###############################################################################
IFS=$'\t' read -r MYSQL_USER MYSQL_PASS MYSQL_HOST MYSQL_PORT MYSQL_NAME < <(parse_mysql_url "$MARIADB_URL")
IFS=$'\t' read -r PG_USER PG_PASS < <(parse_pg_user_pass "$PG_DATABASE_URL")

export MYSQL_PWD="$MYSQL_PASS"
export PGPASSWORD="$PG_PASS"

###############################################################################
# Sanity checks
###############################################################################
echo "==> Checking connectivity"
mariadb --host="$MYSQL_HOST" --port="$MYSQL_PORT" --user="$MYSQL_USER" "$MYSQL_NAME" -e "SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema = DATABASE();" >/dev/null
echo "   MariaDB $MYSQL_NAME@$MYSQL_HOST:$MYSQL_PORT reachable"

psql "$PG_DATABASE_URL" -t -A -c "SELECT version();" >/dev/null
echo "   PostgreSQL target reachable"

if ! grep -q 'provider = "postgresql"' "$PRISMA_SCHEMA"; then
  echo "Error: $PRISMA_SCHEMA must use provider = \"postgresql\" before loading into PostgreSQL." >&2
  echo "   Change provider = \"mysql\" to provider = \"postgresql\" and run 'npx prisma generate' first." >&2
  exit 1
fi

###############################################################################
# 1. Create the PostgreSQL schema from Prisma
###############################################################################
echo "==> Creating PostgreSQL schema (prisma db push)"
DATABASE_URL="$PG_DATABASE_URL" npx prisma db push --schema "$PRISMA_SCHEMA" --skip-generate

###############################################################################
# 2. Dump DATA ONLY from MariaDB, in FK-safe dependency order
###############################################################################
TABLES=(Author Genre Tag Book book_tags book_metadata_candidates)
RAW_DUMP="$(mktemp)"
PG_DUMP="$(mktemp)"
cleanup() { [[ "$KEEP_DUMP" == "1" ]] || rm -f "$RAW_DUMP" "$PG_DUMP"; }
trap cleanup EXIT

echo "==> Dumping data from MariaDB ($DUMP_TOOL --no-create-info --compatible=postgresql)"
MYSQL_PWD="$MYSQL_PASS" "$DUMP_TOOL" \
  --default-character-set=utf8mb4 \
  --host="$MYSQL_HOST" \
  --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" \
  --no-create-info \
  --complete-insert \
  --skip-add-locks \
  --skip-add-drop-table \
  --skip-comments \
  --compatible=postgresql \
  "$MYSQL_NAME" "${TABLES[@]}" \
  > "$RAW_DUMP"

if [[ ! -s "$RAW_DUMP" ]]; then
  echo "Error: dump produced no data." >&2
  exit 1
fi

###############################################################################
# 3. Normalize the dump for PostgreSQL
###############################################################################
echo "==> Normalizing dump for PostgreSQL"
{
  echo "SET standard_conforming_strings = off;"
  echo "SET search_path = public;"
  sed \
    -e 's/`/"/g' \
    -E -e 's/(ENGINE|DEFAULT CHARSET|COLLATE|AUTO_INCREMENT)=[^ ;)]+//g' \
    "$RAW_DUMP"
} > "$PG_DUMP"

###############################################################################
# 4. Load into PostgreSQL inside a single transaction
###############################################################################
echo "==> Loading data into PostgreSQL"
PGPASSWORD="$PG_PASS" psql "$PG_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f "$PG_DUMP"
echo "   Load complete"

###############################################################################
# 5. Verify row counts on both sides
###############################################################################
echo "==> Verifying row counts"
ALL_OK=1
for table in Book Author Genre Tag book_tags book_metadata_candidates; do
  mariadb_count=$(MYSQL_PWD="$MYSQL_PASS" mariadb --host="$MYSQL_HOST" --port="$MYSQL_PORT" --user="$MYSQL_USER" -N -B "$MYSQL_NAME" -e "SELECT COUNT(*) FROM \`$table\`;" 2>/dev/null || echo "?")
  pg_count=$(PGPASSWORD="$PG_PASS" psql "$PG_DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "?")
  if [[ "$mariadb_count" == "$pg_count" && "$mariadb_count" != "?" ]]; then
    status="OK"
  else
    status="MISMATCH"
    ALL_OK=0
  fi
  printf '   %-26s mariadb=%s postgresql=%s [%s]\n' "$table" "$mariadb_count" "$pg_count" "$status"
done

if [[ "$ALL_OK" -ne 0 ]]; then
  echo "==> All table counts match. Migration done."
else
  echo "==> WARNING: some counts differ — inspect the tables above before cutting over." >&2
  exit 1
fi
