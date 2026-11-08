#!/usr/bin/env bash
#
# scripts/pg-backup-common.sh
# Shared helpers for the PostgreSQL backup scripts (local + Neon).
# Source this file from backup-*.sh scripts; it is not meant to be run directly.
#
set -euo pipefail

# have <cmd> -> 0 if $1 is available on PATH
have() { command -v "$1" >/dev/null 2>&1; }

# parse_pg_url <url> -> user pass host port dbname query (tab separated)
parse_pg_url() {
  local url="${1#postgresql://}"
  url="${url#postgres://}"
  local userpass="${url%%@*}"
  local rest="${url#*@}"
  local hostport="${rest%%/*}"
  local dbpart="${rest#*/}"
  local dbname="${dbpart%%\?*}"
  local query=""
  [[ "$dbpart" == *\?* ]] && query="${dbpart#*\?}"
  local user="${userpass%%:*}"
  local pass="${userpass#*:}"
  [[ "$pass" == "$userpass" ]] && pass=""
  local host="${hostport%%:*}"
  local port="${hostport#*:}"
  [[ "$port" == "$hostport" ]] && port="5432"
  port="${port%%/*}"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$user" "$pass" "$host" "$port" "$dbname" "$query"
}

# sslmode_from_query <query> -> prints the sslmode value (or empty)
sslmode_from_query() {
  local q="$1" key val
  local IFS='&'
  for pair in $q; do
    key="${pair%%=*}"
    val="${pair#*=}"
    if [[ "$key" == "sslmode" ]]; then
      printf '%s' "$val"
      return
    fi
  done
}

# run_pg <url> <command> [args...]
# Run a PostgreSQL client command (pg_dump/psql/createdb) authenticated against $url.
# Password is passed via PGPASSWORD (never on argv); sslmode is taken from the URL query.
run_pg() {
  local url="$1"; shift
  IFS=$'\t' read -r _user _pass _host _port _name _query < <(parse_pg_url "$url")
  local sslmode
  sslmode="$(sslmode_from_query "$_query")"
  if [[ -n "$sslmode" ]]; then
    PGPASSWORD="$_pass" PGSSLMODE="$sslmode" "$@"
  else
    PGPASSWORD="$_pass" "$@"
  fi
}

# pg_dump_to_file <url> <outfile> [extra pg_dump args...]
# Dump a PostgreSQL database to a plain SQL file and fail hard on an empty dump.
pg_dump_to_file() {
  local url="$1" outfile="$2"; shift 2
  IFS=$'\t' read -r _user _pass _host _port _name _query < <(parse_pg_url "$url")
  local sslmode
  sslmode="$(sslmode_from_query "$_query")"
  (
    [[ -n "$sslmode" ]] && export PGSSLMODE="$sslmode"
    export PGPASSWORD="$_pass"
    pg_dump --host="$_host" --port="$_port" --username="$_user" --dbname="$_name" \
      --format=plain --no-owner --no-privileges --clean --if-exists "$@" > "$outfile"
  )
}

# rotate_backups <dir> <file-prefix> <keep_count>
# Remove all but the newest $keep_count backups matching ${prefix}_*.sql* in $dir.
rotate_backups() {
  local dir="$1" prefix="$2" keep="$3"
  mapfile -t ALL_BACKUPS < <(ls -1 "$dir"/${prefix}_*.sql* 2>/dev/null | sort -r)
  if [[ "${#ALL_BACKUPS[@]}" -gt "$keep" ]]; then
    for old in "${ALL_BACKUPS[@]:$keep}"; do
      rm -f -- "$old"
      echo "   removed: $old"
    done
  else
    echo "   nothing to rotate (${#ALL_BACKUPS[@]} backups present)"
  fi
}
