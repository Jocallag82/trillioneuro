-- Database tests for the Founders' Record. Run against a scratch database
-- (see scripts/te/run-db-tests.sh). Every check raises on failure.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- fixture: clean slate for te_* data
update public.te_settings set value = 'null' where key in ('operator_name','operator_address');
truncate public.te_referral_clicks, public.te_payment_events, public.te_waitlist, public.te_reports,
         public.te_privacy_requests, public.te_messages, public.te_audit_log, public.rate_limits restart identity cascade;
delete from public.te_entries; delete from public.te_drafts; update public.te_counter set last = 0;
update public.te_settings set value = 'false' where key = 'payments_enabled';
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', false);

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated, service_role;

-- 1. anon has no direct table access
set role anon;
do $$ begin
  begin perform 1 from public.te_entries; raise exception 'FAIL anon read te_entries';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.te_drafts; raise exception 'FAIL anon read te_drafts';
  exception when insufficient_privilege then null; end;
end $$;

-- 2. anon cannot finalize a payment or call admin functions
do $$ begin
  begin perform public.te_finalize_payment('evt_x','cs_x','pi_x',1900,'eur'); raise exception 'FAIL anon finalize';
  exception when insufficient_privilege then null; end;
  begin perform public.te_admin_overview(); raise exception 'FAIL anon admin';
  exception when insufficient_privilege then null; end;
end $$;

-- 3. validation
do $$ begin
  begin perform public.te_create_draft('A','IE','a@b.co',null,false,null,null,true,'2026-10');
        raise exception 'FAIL short nick'; exception when sqlstate '22023' then null; end;
  begin perform public.te_create_draft('Ana','XX','a@b.co',null,false,null,null,true,'2026-10');
        raise exception 'FAIL country'; exception when sqlstate '22023' then null; end;
  begin perform public.te_create_draft('Ana','IE','nope',null,false,null,null,true,'2026-10');
        raise exception 'FAIL email'; exception when sqlstate '22023' then null; end;
  begin perform public.te_create_draft('Ana','IE','a@b.co',null,false,null,null,false,'2026-10');
        raise exception 'FAIL terms'; exception when sqlstate '22023' then null; end;
  begin perform public.te_create_draft('Ana','IE','a@b.co',null,false,repeat('x',281),null,true,'2026-10');
        raise exception 'FAIL long msg'; exception when sqlstate '22023' then null; end;
end $$;

-- 4. draft: html stripped, unicode + emoji kept, real name hidden unless opted in, no number
do $$ declare d jsonb; g jsonb; begin
  d := public.te_create_draft('<b>Zoë 🚀</b>','ie','Buyer@Example.com','Zoë Ní Bhriain',false,'Ar aghaidh! 🇮🇪 <script>',null,true,'2026-10');
  g := public.te_get_draft((d->>'draft_id')::uuid);
  if g->>'nickname' <> 'bZoë 🚀/b' then raise exception 'FAIL sanitise: %', g->>'nickname'; end if;
  if (g->>'show_real_name')::boolean then raise exception 'FAIL show_real_name default'; end if;
  if g->'entry_number' <> 'null'::jsonb then raise exception 'FAIL draft has number'; end if;
  insert into t values ('d1', d->>'draft_id');
end $$;
reset role;

-- 5. payments disabled: checkout refused
set role service_role;
do $$ begin
  begin perform public.te_service_checkout_draft((select v from t where k='d1')::uuid);
        raise exception 'FAIL checkout while disabled'; exception when sqlstate '55000' then null; end;
end $$;
reset role;
-- operator details missing: checkout still refused even with the flag on
update public.te_settings set value = 'true' where key = 'payments_enabled';
set role service_role;
do $$ begin
  begin perform public.te_service_checkout_draft((select v from t where k='d1')::uuid);
        raise exception 'FAIL checkout without operator'; exception when sqlstate '55000' then null; end;
end $$;
reset role;
update public.te_settings set value = '"Test Operator"' where key = 'operator_name';
update public.te_settings set value = '"1 Test Street, Dublin, Ireland"' where key = 'operator_address';

-- 6. checkout + cancelled payment creates nothing
set role service_role;
do $$ declare c jsonb; begin
  c := public.te_service_checkout_draft((select v from t where k='d1')::uuid);
  perform public.te_service_attach_session((select v from t where k='d1')::uuid, 'cs_test_1');
  perform public.te_mark_session('evt_exp_1','cs_test_1','expired');
end $$;
reset role;
do $$ begin
  if (select count(*) from public.te_entries) <> 0 then raise exception 'FAIL entry after expiry'; end if;
  if (select last from public.te_counter) <> 0 then raise exception 'FAIL number consumed'; end if;
end $$;

-- 7. retry checkout, wrong amount refused, then success creates exactly one entry #1
set role service_role;
do $$ declare r jsonb; begin
  perform public.te_service_checkout_draft((select v from t where k='d1')::uuid);
  perform public.te_service_attach_session((select v from t where k='d1')::uuid, 'cs_test_2');
  r := public.te_finalize_payment('evt_bad','cs_test_2','pi_1',100,'eur');
  if r->>'result' <> 'amount_mismatch' then raise exception 'FAIL mismatch: %', r; end if;
  r := public.te_finalize_payment('evt_ok','cs_test_2','pi_1',1900,'EUR');
  if r->>'result' <> 'created' or (r->>'entry_number')::int <> 1 then raise exception 'FAIL create: %', r; end if;
  -- 8. duplicate webhook (same event) and a second event for the same session
  r := public.te_finalize_payment('evt_ok','cs_test_2','pi_1',1900,'eur');
  if r->>'result' <> 'duplicate' then raise exception 'FAIL dup event: %', r; end if;
  r := public.te_finalize_payment('evt_ok_2','cs_test_2','pi_1',1900,'eur');
  if r->>'result' <> 'duplicate' then raise exception 'FAIL dup session: %', r; end if;
  -- a late "expired" for a paid session must not downgrade it
  perform public.te_mark_session('evt_exp_late','cs_test_2','expired');
end $$;
reset role;
do $$ begin
  if (select count(*) from public.te_entries) <> 1 then raise exception 'FAIL entry count'; end if;
  if (select status from public.te_drafts where stripe_session_id='cs_test_2') <> 'paid' then raise exception 'FAIL draft status'; end if;
end $$;

-- 9. public shapes never carry email / private real name
set role anon;
do $$ declare e jsonb; s jsonb; rec jsonb; begin
  e := public.te_entry(1);
  if e is null or e ? 'email' or e->>'real_name' is not null then raise exception 'FAIL public entry: %', e; end if;
  if e->>'country_name' <> 'Ireland' then raise exception 'FAIL country name'; end if;
  rec := public.te_record('zo', null, 'newest', 10, 0);
  if (rec->>'total')::int <> 1 then raise exception 'FAIL search nickname'; end if;
  rec := public.te_record('#1', 'IE', 'oldest', 10, 0);
  if (rec->>'total')::int <> 1 then raise exception 'FAIL search number'; end if;
  rec := public.te_record('100%_', null, 'newest', 10, 0);
  if (rec->>'total')::int <> 0 then raise exception 'FAIL like-escape'; end if;
  s := public.te_stats();
  if (s->>'entries')::int <> 1 or (s->>'countries')::int <> 1 then raise exception 'FAIL stats %', s; end if;
  if s->'net_worth' <> 'null'::jsonb then raise exception 'FAIL net worth fabricated'; end if;
  -- success page: manage key revealed once only
  s := public.te_entry_by_session('cs_test_2');
  if s->>'status' <> 'paid' or s->>'manage_key' is null then raise exception 'FAIL by_session %', s; end if;
  insert into t values ('key', s->>'manage_key'), ('ref', s->>'ref_code');
  s := public.te_entry_by_session('cs_test_2');
  if s->>'manage_key' is not null then raise exception 'FAIL key revealed twice'; end if;
  if public.te_entry_by_session('cs_nope')->>'status' <> 'unknown' then raise exception 'FAIL unknown session'; end if;
end $$;

-- 10. manage: opt-in real name, opt out of referral board
do $$ declare m jsonb; begin
  m := public.te_manage_update((select v from t where k='key'), true, false, false);
  if m->'entry'->>'real_name' <> 'Zoë Ní Bhriain' then raise exception 'FAIL opt-in name %', m; end if;
  begin perform public.te_manage_get('wrong'); raise exception 'FAIL bad key';
  exception when sqlstate '28000' then null; end;
end $$;

-- 11. referrals: self-referral (same email) not attributed; real referral attributed
do $$ declare d jsonb; begin
  d := public.te_create_draft('SelfRef','IE','buyer@example.com',null,false,null,(select v from t where k='ref'),true,'2026-10');
  insert into t values ('d_self', d->>'draft_id');
  d := public.te_create_draft('Friend','FR','friend@example.com',null,false,'Allez',(select v from t where k='ref'),true,'2026-10');
  insert into t values ('d_friend', d->>'draft_id');
  perform public.te_track_referral((select v from t where k='ref'), 'Mozilla/5.0');
  perform public.te_track_referral((select v from t where k='ref'), 'Mozilla/5.0');          -- duplicate
  perform public.te_track_referral((select v from t where k='ref'), 'Googlebot/2.1');        -- bot
end $$;
reset role;
set role service_role;
do $$ begin
  perform public.te_service_checkout_draft((select v from t where k='d_self')::uuid);
  perform public.te_service_attach_session((select v from t where k='d_self')::uuid, 'cs_self');
  perform public.te_finalize_payment('evt_self','cs_self','pi_self',1900,'eur');
  perform public.te_service_checkout_draft((select v from t where k='d_friend')::uuid);
  perform public.te_service_attach_session((select v from t where k='d_friend')::uuid, 'cs_friend');
  perform public.te_finalize_payment('evt_friend','cs_friend','pi_friend',1900,'eur');
end $$;
reset role;
do $$ begin
  if (select referred_by from public.te_entries where entry_number = 2) is not null then raise exception 'FAIL self-referral'; end if;
  if (select referred_by from public.te_entries where entry_number = 3) is null then raise exception 'FAIL referral'; end if;
  if (select count(*) from public.te_referral_clicks where valid) <> 1 then raise exception 'FAIL click dedupe'; end if;
  if (select count(*) from public.te_referral_clicks where not valid) <> 2 then raise exception 'FAIL click flags'; end if;
  if exists (select 1 from public.te_referral_clicks where visitor like '%203.0.113%') then raise exception 'FAIL raw ip stored'; end if;
end $$;
set role anon;
do $$ declare c jsonb; b jsonb; begin
  c := public.te_country_stats();
  if (select (x->>'entries')::int from jsonb_array_elements(c) x where x->>'code'='IE') <> 2 then raise exception 'FAIL country count'; end if;
  if (select (x->>'rank')::int from jsonb_array_elements(c) x where x->>'code'='IE') <> 1 then raise exception 'FAIL country rank'; end if;
  if (select x->>'rank' from jsonb_array_elements(c) x where x->>'code'='DE') is not null then raise exception 'FAIL empty country ranked'; end if;
  b := public.te_referral_board(10);
  if jsonb_array_length(b) <> 0 then raise exception 'FAIL opted-out referrer listed %', b; end if;
end $$;
reset role;

-- 12. refund: leaves public record, number never reused
set role service_role;
select public.te_record_refund('evt_ref','pi_friend');
select public.te_record_refund('evt_ref','pi_friend');
reset role;
set role anon;
do $$ begin
  if public.te_entry(3) is not null then raise exception 'FAIL refunded still public'; end if;
end $$;
reset role;
do $$ begin
  if (select last from public.te_counter) <> 3 then raise exception 'FAIL counter'; end if;
  begin update public.te_entries set entry_number = 99 where entry_number = 1; raise exception 'FAIL immutable';
  exception when raise_exception then if sqlerrm not like 'IMMUTABLE%' then raise; end if; end;
end $$;

-- 13. admin: signed-in non-admin refused; admin allowed and audited
insert into public.te_admins (user_id, email) values ('11111111-1111-1111-1111-111111111111', 'admin@example.com') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  begin perform public.te_admin_overview(); raise exception 'FAIL non-admin';
  exception when sqlstate '42501' then null; end;
  begin perform public.te_admin_set_setting('payments_enabled','false'); raise exception 'FAIL non-admin write';
  exception when sqlstate '42501' then null; end;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ declare o jsonb; begin
  o := public.te_admin_overview();
  if o->'settings' ? 'referral_salt' then raise exception 'FAIL salt exposed'; end if;
  perform public.te_admin_moderate(1, 'approve', 'ok');
  perform public.te_admin_metric_save(null,'personal_net_worth','Founder net worth',1000,'EUR','2026-10-01','Test source','Test methodology text',false);
  perform public.te_admin_set_setting('challenge_started_on','"2026-10-01"');
  begin perform public.te_admin_set_setting('referral_salt','"x"'); raise exception 'FAIL salt write';
  exception when sqlstate '22023' then null; end;
  perform public.te_admin_journal_save(null,'first-update','First update','Ex','Body',null,'{news}','published',null);
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin
  if (public.te_stats())->'net_worth' <> 'null'::jsonb then raise exception 'FAIL unpublished metric shown'; end if;
  if (public.te_entry(1))->>'indexable' <> 'true' then raise exception 'FAIL approve'; end if;
  if jsonb_array_length(public.te_journal_list(10)) <> 1 then raise exception 'FAIL journal'; end if;
  if (public.te_sitemap())->'entries' @> '[{"n":2}]' then raise exception 'FAIL unapproved in sitemap'; end if;
  perform public.te_report_entry(1,'spam','test',null);
  perform public.te_privacy_request('buyer@example.com','hide_name',1,'please');
  perform public.te_contact('x@example.com','general','Hello there',null);
end $$;
reset role;
do $$ begin
  if (select count(*) from public.te_audit_log where action like 'moderate:%') <> 1 then raise exception 'FAIL audit'; end if;
end $$;

-- 14. rate limit on drafts
set role anon;
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.77"}', false);
do $$ declare i int; begin
  for i in 1..20 loop perform public.te_create_draft('Bulk'||i,'IE','b'||i||'@example.com',null,false,null,null,true,'2026-10'); end loop;
  begin perform public.te_create_draft('Bulk21','IE','b21@example.com',null,false,null,null,true,'2026-10');
        raise exception 'FAIL rate limit'; exception when sqlstate '54000' then null; end;
end $$;
reset role;

select 'ALL DB TESTS PASSED' as result;
