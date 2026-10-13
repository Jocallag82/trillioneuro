#!/bin/sh
# 30 drafts, each finalized twice in parallel (60 concurrent webhook deliveries).
# Expect exactly 30 new entries with gap-free sequential numbers.
set -e
P="psql -v ON_ERROR_STOP=1 -qAt -d te_test"
base=$($P -c "select last from te_counter")
$P -c "update te_settings set value='true' where key='payments_enabled'"
for i in $(seq 1 30); do
  id=$($P -c "select gen_random_uuid()")
  $P -c "insert into te_drafts (id,nickname,country,email,price_cents,currency,terms_version,stripe_session_id,status) values ('$id','Conc$i','DE','c$i@example.com',1900,'eur','t','cs_conc_$i','checkout')"
done
for i in $(seq 1 30); do
  for r in a b; do ($P -c "set role service_role; select te_finalize_payment('evt_conc_${i}_$r','cs_conc_$i','pi_conc_$i',1900,'eur')" >/dev/null &) ; done
done
sleep 4
$P -c "select case when count(*)=30 and min(entry_number)=$base+1 and max(entry_number)=$base+30 and count(distinct entry_number)=30 then 'CONCURRENCY OK' else 'CONCURRENCY FAIL '||count(*) end from te_entries where nickname like 'Conc%'"
