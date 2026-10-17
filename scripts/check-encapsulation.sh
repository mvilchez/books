#!/usr/bin/env bash
#
# Encapsulation Validation (PLAN.md — Long-Term Operational Strategies).
#
# The Prisma client must only be imported from service modules (src/lib/**)
# and one-off CLI tools (src/scripts/**). Pages, route handlers, and server
# actions under src/app talk to the database exclusively through @/lib
# services. This script fails (exit 1) when that boundary is violated, so it
# can run in CI or as a pre-commit hook. The same rule is also enforced by
# ESLint (see eslint.config.mjs), but this check needs no toolchain.
set -euo pipefail
cd "$(dirname "$0")/.."

pattern="from ['\"](@/lib/prisma|@prisma/client)['\"]"
violations="$(grep -rnE "$pattern" src/app || true)"

if [ -n "$violations" ]; then
  echo "Encapsulation violation — Prisma client imported in the app layer (src/app):"
  echo "$violations"
  echo
  echo "Move the query into a service module under src/lib and import it from there."
  exit 1
fi

echo "Encapsulation OK: no Prisma client imports under src/app."
