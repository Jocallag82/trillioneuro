#!/bin/sh
# Creates scratch database $1 with the Supabase surface stubs and every migration the movement needs.
# Usage: PGHOST=… PGUSER=postgres sh scripts/mv/setup-db.sh <dbname>
set -e
cd "$(dirname "$0")/../.."
DB="${1:-mv_e2e}"; P="psql -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists $DB" -c "create database $DB" >/dev/null 2>&1
for f in scripts/mv/pg-stub.sql scripts/mv/pg-shared.sql scripts/mv/pg-auth-stub.sql \
         supabase/migrations/20261014_te_beat_elon.sql supabase/migrations/20261014_te_countries_seed.sql \
         supabase/migrations/20261014_te_beat_elon.sql supabase/migrations/20261121_mv_movement.sql \
         supabase/migrations/20261121_mv_movement.sql; do   # applied twice on purpose: must be idempotent
  $P -d "$DB" -f "$f" >/dev/null 2>/tmp/mv_mig.err || { echo "migration failed: $f"; cat /tmp/mv_mig.err; exit 1; }
done
