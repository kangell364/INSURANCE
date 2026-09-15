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
# A FLOOR on how many assertions must actually report success.
#
# Why this exists: every assertion in these suites announces itself with a
# `raise notice 'ok ...'`, and a passing exit code on its own does not prove
# they ran -- only that nothing raised. A suite that silently stopped
# executing, a file that stopped matching the glob, or a transaction that
# rolled back early would all exit zero while proving nothing.
#
# This is a minimum, not an expected value, so adding assertions never
# requires touching it. It trips only when assertions DISAPPEAR, which is
# exactly the change nobody means to make.
MIN_ASSERTIONS="${TEP_MIN_ASSERTIONS:-119}"
total=0

for suite in "${ROOT}"/supabase/tests/local/*_assertions.sql; do
  echo "==> Running $(basename "${suite}")"
  # psql writes `raise notice` to stderr, so it is teed to count the passes
  # while still being shown.
  output=$("${PSQL[@]}" -d "${DB_NAME}" -f "${suite}" 2>&1 | tee /dev/stderr)
  count=$(printf '%s\n' "${output}" | grep -c 'NOTICE:  ok' || true)
  echo "    ${count} assertions passed"
  total=$(( total + count ))
done

echo "==> ${total} assertions passed in total (minimum ${MIN_ASSERTIONS})"
if [ "${total}" -lt "${MIN_ASSERTIONS}" ]; then
  echo "ERROR: only ${total} assertions ran, expected at least ${MIN_ASSERTIONS}." >&2
  echo "Assertions were removed, or a suite stopped executing part way." >&2
  exit 1
fi

# Applied last and only to check it is valid SQL against the current schema.
# Nothing asserts on it.
echo "==> Applying seed data"
"${PSQL[@]}" -d "${DB_NAME}" -f "${ROOT}/supabase/seed.sql" >/dev/null

echo "==> Dropping database ${DB_NAME}"
"${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME};" >/dev/null

echo
echo "All RLS assertions passed."
