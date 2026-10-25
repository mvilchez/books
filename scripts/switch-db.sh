#!/usr/bin/env bash
#
# scripts/switch-db.sh
#
# Switch the Books app's active DATABASE_URL (in .env, the dev config) between
# a local database and a remote database. Remote targets are read from
# .env.production, which acts as a read-only registry of available databases:
#
#   * DATABASE_URL   -> MariaDB cloud (SkySQL / Aiven)
#   * POSTGRES_URL   -> NeonDB (PostgreSQL)
#
# .env.production is NEVER overwritten — both remote URLs stay available as a
# registry. Only .env (dev) is switched, plus prisma/schema.prisma provider
# and Prisma client generation when moving between MariaDB and PostgreSQL.
#
# Named targets:
#   * local        — local MariaDB (127.0.0.1:3306), Prisma `mysql` provider
#   * cloud / mariadb — DATABASE_URL  from .env.production (SkySQL/Aiven MariaDB)
#   * neon / postgres — POSTGRES_URL from .env.production (NeonDB PostgreSQL)
#
# You can also pass an explicit URL as the second argument to override.
#
# Usage:
#   ./scripts/switch-db.sh local
#   ./scripts/switch-db.sh cloud            # uses DATABASE_URL from .env.production
#   ./scripts/switch-db.sh neon             # uses POSTGRES_URL from .env.production
#   ./scripts/switch-db.sh status
#
set -euo pipefail

ENV_FILE=".env"
PROD_ENV_FILE=".env.production"
SCHEMA_FILE="prisma/schema.prisma"
LOCAL_URL="mysql://book:password@127.0.0.1:3306/reading_tracker_local"
LOCAL_PG_URL="postgresql://book:password@127.0.0.1:5432/reading_tracker_local"

###############################################################################
# Helpers
###############################################################################
have() { command -v "$1" >/dev/null 2>&1; }

# read_env_value <file> <key>  -> prints the value (without surrounding quotes)
read_env_value() {
  local file="$1" key="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | sed -E "s/^${key}=//; s/^\"//; s/\"$//"
}

# write_env_value <file> <key> <value>  -> replaces the KEY= line (or appends)
write_env_value() {
  local file="$1" key="$2" value="$3"
  python3 - "$file" "$key" "$value" <<'PYEOF'
import sys, re
file, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
with open(file, "r", encoding="utf-8") as f:
    content = f.read()
pattern = re.compile(rf"^(#?\s*{re.escape(key)}=.*)$", re.MULTILINE)
replacement = f'{key}="{value}"'
content, n = pattern.subn(replacement, content, count=1)
if n == 0:
    content = content.rstrip() + f"\n{key}=\"{value}\"\n"
with open(file, "w", encoding="utf-8") as f:
    f.write(content)
PYEOF
}

# Resolve a URL for a named remote target, reading from .env.production
resolve_target_url() {
  local target="$1"   # cloud | mariadb | neon | postgres
  local explicit="${2:-}"
  local url

  if [[ -n "$explicit" ]]; then
    url="$explicit"
  else
    case "$target" in
      cloud|mariadb)
        url="$(read_env_value "$PROD_ENV_FILE" DATABASE_URL)"
        ;;
      neon|postgres)
        url="$(read_env_value "$PROD_ENV_FILE" POSTGRES_URL)"
        ;;
    esac
  fi

  if [[ -z "$url" ]]; then
    echo "Error: no URL found for target '$target' in .env.production." >&2
    echo "   Add DATABASE_URL (MariaDB) or POSTGRES_URL (NeonDB) to .env.production," >&2
    echo "   or pass the URL explicitly as the second argument." >&2
    exit 1
  fi

  echo "$url"
}

# current provider from schema.prisma
current_provider() {
  grep -E '^\s*provider\s*=' "$SCHEMA_FILE" | head -1 | sed -E 's/.*provider\s*=\s*"([^"]+)".*/\1/'
}

# Check migration lock provider when switching database providers
check_migration_lock() {
  local target="$1"
  local lock_file="prisma/migrations/migration_lock.toml"
  if [[ -f "$lock_file" ]]; then
    local lock_provider
    lock_provider=$(grep -E '^\s*provider\s*=' "$lock_file" | head -1 | sed -E 's/.*=\s*"([^"]+)".*/\1/')
    if [[ -n "$lock_provider" && "$lock_provider" != "$target" ]]; then
      echo ""
      echo "⚠  WARNING: prisma/migrations/migration_lock.toml has provider='$lock_provider'"
      echo "   but you are switching to $target. Prisma migrate will refuse to run"
      echo "   (P3019: provider mismatch)."
      echo ""
      echo "   To start fresh with $target:"
      echo "     rm prisma/migrations/migration_lock.toml"
      echo "     rm -rf prisma/migrations/     # optional: remove old MySQL migrations"
      echo "     npx prisma db push          # creates schema in the new database"
      echo ""
    fi
  fi
}

# set_schema_provider <mysql|postgresql>
set_schema_provider() {
  local target="$1"
  local current
  current="$(current_provider)"
  if [[ "$current" == "$target" ]]; then
    echo "   schema.prisma provider already $target"
    return 0
  fi
  echo "   Switching schema.prisma provider: $current -> $target"
  python3 - "$SCHEMA_FILE" "$target" <<'PYEOF'
import sys
file, target = sys.argv[1], sys.argv[2]
with open(file, "r", encoding="utf-8") as f:
    content = f.read()
if target == "postgresql":
    content = content.replace('provider = "mysql"', 'provider = "postgresql"')
else:
    content = content.replace('provider = "postgresql"', 'provider = "mysql"')
with open(file, "w", encoding="utf-8") as f:
    f.write(content)
PYEOF
  echo "   Regenerating Prisma client (npx prisma generate)"
  npx prisma generate --schema "$SCHEMA_FILE"
}

###############################################################################
# Modes
###############################################################################
cmd="${1:-}"

# Prefer the developer's actual local PostgreSQL credentials when present.
if [[ -f ".env.local" ]]; then
  _local_pg="$(read_env_value .env.local DATABASE_URL 2>/dev/null || true)"
  [[ -n "$_local_pg" ]] && LOCAL_PG_URL="$_local_pg"
fi

case "$cmd" in
  local)
    echo "==> Switching to LOCAL MariaDB"
    write_env_value "$ENV_FILE" DATABASE_URL "$LOCAL_URL"
    set_schema_provider "mysql"
    echo "   Done. Local MariaDB configured in .env (.env.production left untouched)."
    echo "   Next: npx prisma db push   (to sync schema to local DB)"
    ;;

  cloud|mariadb)
    url="$(resolve_target_url "cloud" "${2:-}")"
    if [[ ! "$url" == mysql://* ]]; then
      echo "Error: resolved URL must start with mysql:// (got: $url)" >&2
      exit 1
    fi
    echo "==> Switching to MARIADB CLOUD"
    write_env_value "$ENV_FILE" DATABASE_URL "$url"
    set_schema_provider "mysql"
    check_migration_lock "mysql"
    echo "   Done. MariaDB cloud configured in .env (.env.production left untouched)."
    echo "   Next: npx prisma migrate deploy   (to apply schema to cloud DB)"
    ;;

  neon|postgres)
    url="$(resolve_target_url "neon" "${2:-}")"
    if [[ ! "$url" == postgresql://* ]]; then
      echo "Error: resolved URL must start with postgresql:// (got: $url)" >&2
      exit 1
    fi
    echo "==> Switching to NEONDB (PostgreSQL)"
    write_env_value "$ENV_FILE" DATABASE_URL "$url"
    set_schema_provider "postgresql"
    check_migration_lock "postgresql"
    echo "   Done. NeonDB configured in .env (.env.production left untouched)."
    echo "   Next: npx prisma db push   (to sync schema to NeonDB)"
    ;;

  local-postgres|local-pg|postgres-local)
    echo "==> Switching to LOCAL PostgreSQL"
    write_env_value "$ENV_FILE" DATABASE_URL "$LOCAL_PG_URL"
    set_schema_provider "postgresql"
    check_migration_lock "postgresql"
    echo "   Done. Local PostgreSQL configured in .env."
    echo "   Next: npx prisma db push   (to sync schema to local PostgreSQL)"
    ;;

  status)
    echo "==> Current database configuration"
    echo "   .env (dev — active):"
    dev_url="$(read_env_value "$ENV_FILE" DATABASE_URL || echo '<not set>')"
    echo "     DATABASE_URL=$dev_url"
    echo "   .env.production (registry — remote URLs):"
    prod_db="$(read_env_value "$PROD_ENV_FILE" DATABASE_URL || echo '<not set>')"
    prod_pg="$(read_env_value "$PROD_ENV_FILE" POSTGRES_URL || echo '<not set>')"
    echo "     DATABASE_URL =$prod_db      (MariaDB cloud / SkySQL)"
    echo "     POSTGRES_URL=$prod_pg       (NeonDB PostgreSQL)"
    echo "   schema.prisma provider: $(current_provider)"
    echo ""
    if [[ "$dev_url" == "$LOCAL_URL" ]]; then
      echo "   Active target: LOCAL MariaDB"
    elif [[ "$dev_url" == "$LOCAL_PG_URL" ]]; then
      echo "   Active target: LOCAL PostgreSQL"
    elif [[ "$dev_url" == postgresql://* ]]; then
      echo "   Active target: REMOTE PostgreSQL (NeonDB)"
    elif [[ "$dev_url" == mysql://* ]]; then
      echo "   Active target: REMOTE MariaDB (cloud)"
    else
      echo "   Active target: unknown / not set"
    fi
    ;;

  --help|-h|*)
    echo "Usage: $0 {local|local-postgres|cloud|mariadb|neon|postgres|status} [DATABASE_URL]"
    echo ""
    echo "  local                          Switch to local MariaDB (127.0.0.1:3306)
  local-postgres | local-pg      Switch to local PostgreSQL (127.0.0.1:5432)"
    echo "  cloud | mariadb                Switch to MariaDB cloud (SkySQL / Aiven)"
    echo "                                 Reads DATABASE_URL from .env.production"
    echo "  neon | postgres                Switch to NeonDB (PostgreSQL)"
    echo "                                 Reads POSTGRES_URL from .env.production"
    echo "  status                         Show current configuration"
    echo ""
    echo "You can also pass an explicit URL as the second argument to override:"
    echo "  $0 cloud  \"mysql://user:pass@host:4014/db?sslaccept=strict\""
    echo "  $0 neon   \"postgresql://user:pass@host.region.neon.tech/db?sslmode=require\""
    echo ""
    echo "Notes:"
    echo "  * .env (dev) is switched; .env.production is left untouched as a registry"
    echo "    holding both DATABASE_URL (SkySQL MariaDB) and POSTGRES_URL (NeonDB)."
    echo "  * .env and .env.production are gitignored — credentials stay local."
    echo "  * Switching mysql <-> postgresql updates schema.prisma and runs"
    echo "    'npx prisma generate' automatically."
    echo "  * After switching, run 'npx prisma db push' (local/dev) or"
    echo "    'npx prisma migrate deploy' (production/cloud) to apply the schema."
    echo "  * Switching providers may trigger P3019 if prisma/migrations/"
    echo "    migration_lock.toml was created with a different provider. Remove"
    echo "    migration_lock.toml and use 'prisma db push' to start fresh."
    exit 0
    ;;
esac
