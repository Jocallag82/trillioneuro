#!/bin/sh
# Applies the Founders' Record migrations to a scratch local Postgres and runs the SQL tests.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres sh scripts/te/run-db-tests.sh
set -e
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists te_test" -c "create database te_test" >/dev/null
for f in scripts/te/pg-stub.sql scripts/te/pg-shared.sql supabase/migrations/20261014_te_beat_elon.sql \
         supabase/migrations/20261014_te_countries_seed.sql supabase/migrations/20261014_te_beat_elon.sql \
         supabase/migrations/20261014_te_retention.sql; do
  $P -d te_test -f "$f" >/dev/null 2>&1 || { echo "migration failed: $f"; $P -d te_test -f "$f"; exit 1; }
done
$P -d te_test -f scripts/te/db.test.sql
