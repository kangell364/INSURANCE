#!/usr/bin/env bash
#
# Run the database + RLS assertion suites against a plain PostgreSQL server.
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

# Every assertion file in order. 00_ is the Supabase shim, applied above; the
# rest are suites, each self-contained and each wrapped in its own transaction.
#
# The suites run against a schema with NO seed data, and each creates the rows
# it needs. That matters because several assertions are counts -- "an anonymous
# visitor sees exactly one module" -- and a count is only meaningful when the
# suite owns every row in the table. Running these after the seed made adding a
# sample lesson break the security tests, which trains everyone to edit the
# assertion instead of asking why it moved.
#
# The seed is applied afterwards instead, purely to prove it still loads.
for suite in "${ROOT}"/supabase/tests/local/*_assertions.sql; do
  echo "==> Running $(basename "${suite}")"
  "${PSQL[@]}" -d "${DB_NAME}" -f "${suite}"
done

# Applied last and only to check it is valid SQL against the current schema.
# Nothing asserts on it.
echo "==> Applying seed data"
"${PSQL[@]}" -d "${DB_NAME}" -f "${ROOT}/supabase/seed.sql" >/dev/null

echo "==> Dropping database ${DB_NAME}"
"${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME};" >/dev/null

echo
echo "All RLS assertions passed."
