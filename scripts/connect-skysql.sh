#!/usr/bin/env bash
set -euo pipefail

if ! command -v mariadb >/dev/null 2>&1; then
  echo "Error: the MariaDB command-line client (mariadb) is not installed." >&2
  exit 1
fi

exec mariadb \
  --host serverless-us-east1.sysp0000.db2.skysql.com \
  --port 4014 \
  --user dbpgf14648016 \
  -p \
  --ssl-verify-server-cert \
  "$@"
