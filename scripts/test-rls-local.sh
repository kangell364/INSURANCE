#!/usr/bin/env bash
#
# Run the Phase 1 database + RLS assertions against a plain PostgreSQL server.
#
# Use this when Docker (and therefore `supabase start` / `supabase test db`)
# is unavailable. It creates a throwaway database, applies the Supabase shim,
# applies every migration in supabase/migrations in order, then runs the
# assertion suite. Any failed assertion aborts with a non-zero exit code.
#
# Usage:
#   scripts/test-rls-local.sh                       # uses PGHOST/PGPORT/PGUSER
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres scripts/test-rls-local.sh
#
# With the Supabase CLI available, prefer:  supabase test db
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${TEP_TEST_DB:-texas_exam_prep_rls_test}"

PSQL=(psql --quiet --no-psqlrc -v ON_ERROR_STOP=1)

echo "==> Recreating database ${DB_NAME}"
"${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME};" >/dev/null
"${PSQL[@]}" -d postgres -c "create database ${DB_NAME};" >/dev/null

echo "==> Applying Supabase compatibility shim"
"${PSQL[@]}" -d "${DB_NAME}" -f "${ROOT}/supabase/tests/local/00_supabase_shim.sql" >/dev/null

echo "==> Applying migrations"
for migration in "${ROOT}"/supabase/migrations/*.sql; do
  echo "    - $(basename "${migration}")"
  "${PSQL[@]}" -d "${DB_NAME}" -f "${migration}" >/dev/null
done

echo "==> Applying seed data"
"${PSQL[@]}" -d "${DB_NAME}" -f "${ROOT}/supabase/seed.sql" >/dev/null

echo "==> Running RLS assertions"
"${PSQL[@]}" -d "${DB_NAME}" -f "${ROOT}/supabase/tests/local/01_rls_assertions.sql"

echo "==> Dropping database ${DB_NAME}"
"${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME};" >/dev/null

echo
echo "All Phase 1 RLS assertions passed."
