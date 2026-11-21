#!/bin/sh
# Applies the migrations to a scratch Postgres and runs the SQL tests.
# Usage: PGHOST=… PGUSER=postgres PGPASSWORD=… sh scripts/mv/run-db-tests.sh
set -e
cd "$(dirname "$0")/.."/..
sh scripts/mv/setup-db.sh mv_test
psql -v ON_ERROR_STOP=1 -q -d mv_test -f scripts/mv/db.test.sql
