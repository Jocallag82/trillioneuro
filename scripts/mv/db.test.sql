-- Database tests for the movement (mv_*). Run via scripts/mv/run-db-tests.sh. Every check raises on failure.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.50"}', false);

-- Fixed users
create temp table u (k text primary key, id uuid);
grant all on u to anon, authenticated, service_role;
insert into u values ('ana','a0000000-0000-0000-0000-000000000001'),('bob','b0000000-0000-0000-0000-000000000002'),
  ('cat','c0000000-0000-0000-0000-000000000003'),('dan','d0000000-0000-0000-0000-000000000004'),
  ('eve','e0000000-0000-0000-0000-000000000005'),('adm','f0000000-0000-0000-0000-000000000006'),
  ('rtt','99999999-0000-0000-0000-000000000007');

create or replace function pg_temp.as_user(p_k text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', (select id::text from u where k = p_k), false); end $$;
create or replace function pg_temp.cc(c text) returns int language sql security definer as $$ select n from public.mv_country_counts where country_code = c $$;
create or replace function pg_temp.clear_rl() returns void language sql security definer as $$ delete from public.rate_limits $$;

-- 0. seed sanity ---------------------------------------------------------------------------------
do $$ begin
  assert (select count(*) from public.mv_countries) >= 240, 'countries seeded';
  assert (select count(distinct slug) from public.mv_countries) = (select count(*) from public.mv_countries), 'slugs unique';
  assert (select slug from public.mv_countries where code = 'IE') = 'ireland', 'ireland slug';
  assert (select slug from public.mv_countries where code = 'GB') = 'united-kingdom', 'uk slug: ' || (select slug from public.mv_countries where code = 'GB');
  assert (select slug from public.mv_countries where code = 'US') = 'united-states', 'us slug: ' || (select slug from public.mv_countries where code = 'US');
  assert (select count(*) from public.mv_ideas where kind = 'seed' and status = 'live') = 7, '7 seed priorities';
  assert (select count(*) from public.mv_announcements) = 0, 'no fabricated announcements';
  assert (select count(*) from public.mv_milestones) = 0, 'no fabricated milestones';
end $$;

-- 1. empty launch state: zeros, never invented ----------------------------------------------------
set role anon;
do $$ declare s jsonb; b jsonb; begin
  s := public.mv_public_stats();
  assert (s ->> 'contributors')::int = 0 and (s ->> 'countries')::int = 0 and (s ->> 'votes')::int = 0 and (s ->> 'ideas')::int = 0, 'launch stats are zero: ' || s;
  assert (s ->> 'next_milestone')::int = 100, 'next milestone 100';
  assert jsonb_array_length(s -> 'milestones') = 0, 'no milestones reached';
  b := public.mv_country_board();
  assert jsonb_array_length(b) >= 240, 'board lists every country';
  assert not exists (select 1 from jsonb_array_elements(b) e where (e ->> 'contributors')::int > 0), 'board all zero';
  assert (public.mv_country('ireland') ->> 'contributors')::int = 0 and (public.mv_country('ireland') -> 'rank') = 'null'::jsonb, 'ie zero, unranked';
  assert public.mv_country('atlantis') is null, 'unknown country';
  assert (public.mv_priorities() ->> 'total_votes')::int = 0, 'no votes';
end $$;

-- 2. anon has no direct access to personal tables or write functions -------------------------------
do $$ begin
  begin perform 1 from public.mv_profiles; raise exception 'FAIL anon read profiles'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.mv_votes; raise exception 'FAIL anon read votes'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.mv_referrals; raise exception 'FAIL anon read referrals'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.mv_invites; raise exception 'FAIL anon read invites'; exception when insufficient_privilege then null; end;
  begin perform author_id from public.mv_ideas; raise exception 'FAIL anon read author_id'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.mv_counters; raise exception 'FAIL anon read counters'; exception when insufficient_privilege then null; end;
  begin insert into public.mv_votes values (1, gen_random_uuid(), 1); raise exception 'FAIL anon insert vote'; exception when insufficient_privilege then null; end;
  begin perform public.mv_cast_vote(1); raise exception 'FAIL anon vote'; exception when insufficient_privilege then null; end;
  begin perform public.mv_my_dashboard(); raise exception 'FAIL anon dashboard'; exception when insufficient_privilege then null; end;
  begin perform public.mv_confirm_profile(gen_random_uuid()); raise exception 'FAIL anon confirm'; exception when insufficient_privilege then null; end;
  begin perform public.mv_recount(); raise exception 'FAIL anon recount'; exception when insufficient_privilege then null; end;
  perform 1 from public.mv_ideas;            -- public columns are readable
  perform 1 from public.mv_countries;
end $$;

-- 3. sign-up through the auth trigger -------------------------------------------------------------
reset role;
-- 3a. other products' users are untouched
insert into auth.users (id, email, email_confirmed_at) select id, 'rtt@example.com', now() from u where k = 'rtt';
do $$ begin assert (select count(*) from public.mv_profiles) = 0, 'non-mv signup creates no profile'; end $$;

-- 3b. validation: each of these must be rejected (and roll the user insert back)
do $$ declare n int := 0; begin
  begin insert into auth.users (email, raw_user_meta_data) values ('x1@e.co', '{"mv":"1","full_name":"","country":"IE","terms":"1"}'); exception when sqlstate '22023' then n := n + 1; end;
  begin insert into auth.users (email, raw_user_meta_data) values ('x2@e.co', '{"mv":"1","full_name":"X","country":"ZZ","terms":"1"}'); exception when sqlstate '22023' then n := n + 1; end;
  begin insert into auth.users (email, raw_user_meta_data) values ('x3@e.co', '{"mv":"1","full_name":"X","country":"IE"}'); exception when sqlstate '22023' then n := n + 1; end;
  begin insert into auth.users (email, raw_user_meta_data) values ('x4@e.co', '{"mv":"1","full_name":"X","country":"IE","terms":"1","hp":"bot"}'); exception when sqlstate '22023' then n := n + 1; end;
  assert n = 4, 'all four invalid signups rejected, got ' || n;
  assert (select count(*) from auth.users where email like 'x_@e.co') = 0, 'rejected signups left no auth rows';
end $$;

-- 3c. Ana signs up UNconfirmed (email confirmation on): profile exists but is not counted
insert into auth.users (id, email, raw_user_meta_data)
select id, 'ana@example.com', '{"mv":"1","full_name":"<b>Ana</b> Byrne","display_name":"Ana","country":"ie","terms":"1","marketing":"1"}'::jsonb from u where k = 'ana';
do $$ declare p public.mv_profiles; begin
  select * into p from public.mv_profiles where user_id = (select id from u where k = 'ana');
  assert p.full_name = 'b Ana/b Byrne' or p.full_name = 'bAna/b Byrne' or position('<' in p.full_name) = 0, 'markup stripped: ' || p.full_name;
  assert p.country_code = 'IE' and p.marketing_consent and p.marketing_consent_at is not null, 'country+consent';
  assert p.confirmed_at is null and p.founding_number is null, 'unconfirmed: no number';
  assert (public.mv_public_stats() ->> 'contributors')::int = 0, 'unconfirmed not counted';
  assert p.referral_code ~ '^[0-9a-f]{10}$', 'referral code';
end $$;

-- 3d. confirming the email counts her and numbers her
update auth.users set email_confirmed_at = now() where id = (select id from u where k = 'ana');
update auth.users set email_confirmed_at = now() where id = (select id from u where k = 'ana');   -- replay: no double count
do $$ declare p public.mv_profiles; begin
  select * into p from public.mv_profiles where user_id = (select id from u where k = 'ana');
  assert p.founding_number = 1 and p.confirmed_at is not null, 'Ana is Nº 1';
  assert (select value from public.mv_counters where key = 'contributors') = 1, 'one contributor';
  assert (select n from public.mv_country_counts where country_code = 'IE') = 1, 'IE = 1';
end $$;

-- 3e. Bob joins with Ana's referral link, already confirmed (email confirmation off)
select set_config('mv.ana_code', (select referral_code from public.mv_profiles where user_id = (select id from u where k = 'ana')), false);
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select id, 'bob@example.com', now(),
  jsonb_build_object('mv','1','full_name','Bob Smith','country','GB','terms','1','ref', current_setting('mv.ana_code')) from u where k = 'bob';
-- Cat: unknown ref code → no attribution, still joins; Dan tries to refer himself via his own code later
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select id, 'cat@example.com', now(), '{"mv":"1","full_name":"Cat","country":"IE","terms":"1","ref":"deadbeef00"}'::jsonb from u where k = 'cat';
do $$ begin
  assert (select referrer_id from public.mv_referrals where referred_id = (select id from u where k = 'bob')) = (select id from u where k = 'ana'), 'Bob attributed to Ana';
  assert not exists (select 1 from public.mv_referrals where referred_id = (select id from u where k = 'cat')), 'bogus code ignored';
  assert (select founding_number from public.mv_profiles where user_id = (select id from u where k = 'bob')) = 2, 'Bob Nº 2';
  assert (select founding_number from public.mv_profiles where user_id = (select id from u where k = 'cat')) = 3, 'Cat Nº 3';
  begin   -- attribution is write-once and self-referral is impossible by constraint
    insert into public.mv_referrals (referred_id, referrer_id) select id, id from u where k = 'ana';
    raise exception 'FAIL self referral';
  exception when check_violation then null; end;
  begin
    insert into public.mv_referrals (referred_id, referrer_id) select (select id from u where k = 'bob'), (select id from u where k = 'cat');
    raise exception 'FAIL re-attribution';
  exception when unique_violation then null; end;
end $$;

-- 4. public aggregates are real and exclude personal data ---------------------------------------------
set role anon;
do $$ declare s jsonb; b jsonb; ie jsonb; gb jsonb; c jsonb; begin
  s := public.mv_public_stats();
  assert (s ->> 'contributors')::int = 3 and (s ->> 'countries')::int = 2, 'stats 3 / 2: ' || s;
  b := public.mv_country_board();
  select e into ie from jsonb_array_elements(b) e where e ->> 'code' = 'IE';
  select e into gb from jsonb_array_elements(b) e where e ->> 'code' = 'GB';
  assert (ie ->> 'contributors')::int = 2 and (ie ->> 'rank')::int = 1 and (ie ->> 'pct')::numeric = 66.67, 'IE rank 1, 66.67%: ' || ie;
  assert (gb ->> 'contributors')::int = 1 and (gb ->> 'rank')::int = 2 and (gb ->> 'growth_7d')::int = 1, 'GB rank 2';
  c := public.mv_country('ireland');
  assert (c ->> 'contributors')::int = 2 and jsonb_array_length(c -> 'series') = 14, 'country page data';
  assert c::text not like '%example.com%' and c::text not like '%Byrne%', 'no personal data in public country payload';
  assert public.mv_ref_landing(current_setting('mv.ana_code')) ->> 'display_name' = 'Ana', 'ref landing shows chosen display name';
  assert (public.mv_ref_landing('0000000000') ->> 'valid') = 'false', 'unknown ref';
end $$;

-- 5. RLS: a signed-in user sees only their own rows ---------------------------------------------------------
set role authenticated;
select pg_temp.as_user('bob');
do $$ begin
  assert (select count(*) from public.mv_profiles) = 1 and (select full_name from public.mv_profiles) = 'Bob Smith', 'bob sees only himself';
  assert (select count(*) from public.mv_referrals) = 0, 'bob has referred nobody';
  begin update public.mv_profiles set founding_number = 1; raise exception 'FAIL direct profile update'; exception when insufficient_privilege then null; end;
  begin insert into public.mv_votes values (1, (select id from u where k = 'bob'), 1); raise exception 'FAIL direct vote insert'; exception when insufficient_privilege then null; end;
  begin perform public.mv_admin_announce('x', 'y'); raise exception 'FAIL non-admin announce'; exception when insufficient_privilege then null; end;
  begin perform public.mv_confirm_profile((select id from u where k = 'bob')); raise exception 'FAIL user confirm'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('ana');
do $$ begin
  assert (select count(*) from public.mv_referrals) = 1, 'ana sees her referral';
  assert (select count(*) from public.mv_profiles) = 1 and (select full_name from public.mv_profiles) not like 'Bob%', 'ana sees only herself';
end $$;

-- 6. voting integrity -----------------------------------------------------------------------------------------
select pg_temp.clear_rl();
do $$ declare r jsonb; water bigint; hunger bigint; begin
  select id into water  from public.mv_ideas where slug = 'clean-water';
  select id into hunger from public.mv_ideas where slug = 'poverty-hunger';
  r := public.mv_cast_vote(water);
  assert (r ->> 'total_votes')::int = 1 and (r ->> 'my_vote')::bigint = water, 'vote counted, my_vote set';
  assert (select (e ->> 'pct')::numeric from jsonb_array_elements(r -> 'ideas') e where (e ->> 'id')::bigint = water) = 100, '100% after one vote';
  begin perform public.mv_cast_vote(hunger); raise exception 'FAIL second vote'; exception when sqlstate '22023' then null; end;
  begin perform public.mv_cast_vote(water);  raise exception 'FAIL repeat vote';  exception when sqlstate '22023' then null; end;
  begin perform public.mv_cast_vote(999999); raise exception 'FAIL bad idea';    exception when sqlstate '22023' then null; end;
  assert (public.mv_public_stats() ->> 'votes')::int = 1, 'exactly one vote cast';
end $$;

-- an unconfirmed user cannot vote
reset role;
insert into auth.users (id, email, raw_user_meta_data)
select id, 'dan@example.com', '{"mv":"1","full_name":"Dan","country":"US","terms":"1"}'::jsonb from u where k = 'dan';
set role authenticated; select pg_temp.as_user('dan');
do $$ begin
  begin perform public.mv_cast_vote((select id from public.mv_ideas where slug = 'healthcare')); raise exception 'FAIL unconfirmed vote';
  exception when sqlstate '42501' then null; end;
  begin perform public.mv_submit_idea('A fine title here', 'A long enough summary of the idea'); raise exception 'FAIL unconfirmed idea';
  exception when sqlstate '42501' then null; end;
end $$;

-- a closed round refuses votes
reset role;
update public.mv_rounds set status = 'closed';
set role authenticated; select pg_temp.as_user('cat'); select pg_temp.clear_rl();
do $$ begin
  begin perform public.mv_cast_vote((select id from public.mv_ideas where slug = 'healthcare')); raise exception 'FAIL closed round';
  exception when sqlstate '22023' then null; end;
end $$;
reset role; update public.mv_rounds set status = 'open'; set role authenticated;

-- votes never exceed one per user, even under a forced race on the PK
select pg_temp.as_user('cat'); select pg_temp.clear_rl();
do $$ begin
  perform public.mv_cast_vote((select id from public.mv_ideas where slug = 'healthcare'));
  assert (select count(*) from public.mv_votes) = 1, 'cat sees only her own vote';
end $$;
reset role;
do $$ begin
  begin insert into public.mv_votes (round_id, user_id, idea_id) select round_id, (select id from u where k = 'cat'), id from public.mv_ideas where slug = 'housing';
        raise exception 'FAIL PK allows second vote'; exception when unique_violation then null; end;
  assert (select count(*) from public.mv_votes) = 2, 'two votes total';
  assert (select sum(vote_count) from public.mv_ideas) = 2, 'per-idea counters agree';
end $$;

-- 7. ideas: sanitised, moderated, rate limited ------------------------------------------------------------------------
set role authenticated; select pg_temp.as_user('bob'); select pg_temp.clear_rl();
do $$ declare r jsonb; begin
  begin perform public.mv_submit_idea('Hi', 'too short'); raise exception 'FAIL short'; exception when sqlstate '22023' then null; end;
  begin perform public.mv_submit_idea('Visit my site', 'Buy now at https://spam.example/now for cheap pills'); raise exception 'FAIL link'; exception when sqlstate '22023' then null; end;
  r := public.mv_submit_idea('Ocean <script>plastic</script> cleanup', 'Fund fleets that pull plastic out of the ocean and rivers.');
  assert r ->> 'status' = 'pending', 'pending until reviewed';
  begin perform public.mv_submit_idea('ocean scriptplastic/script cleanup', 'Duplicate of the idea above, in other words.'); raise exception 'FAIL dup'; exception when sqlstate '22023' then null; end;
  assert (public.mv_my_dashboard() -> 'my_ideas' -> 0 ->> 'title') not like '%<%', 'markup stripped from title';
  assert (public.mv_priorities() -> 'ideas') @> '[]' and (select count(*) from jsonb_array_elements(public.mv_priorities() -> 'ideas') e where e ->> 'kind' = 'community') = 0, 'pending idea is not public';
  assert (public.mv_my_dashboard() -> 'my_ideas' -> 0 ->> 'status') = 'pending', 'author sees it as pending';
  perform public.mv_submit_idea('Second idea title', 'A perfectly fine second idea summary.');
  perform public.mv_submit_idea('Third idea title', 'A perfectly fine third idea summary.');
  begin perform public.mv_submit_idea('Fourth idea title', 'One more than the daily limit allows.'); raise exception 'FAIL daily limit'; exception when sqlstate '54000' then null; end;
end $$;
-- only an admin can publish
do $$ begin begin perform public.mv_admin_review_idea(1, 'live'); raise exception 'FAIL non-admin review'; exception when insufficient_privilege then null; end; end $$;
reset role;
insert into auth.users (id, email, email_confirmed_at) select id, 'adm@example.com', now() from u where k = 'adm';
insert into public.te_admins (user_id, email) select id, 'adm@example.com' from u where k = 'adm';
set role authenticated; select pg_temp.as_user('adm'); select pg_temp.clear_rl();
do $$ declare pend jsonb; v jsonb; begin
  pend := public.mv_admin_pending_ideas();
  assert jsonb_array_length(pend) = 3, 'admin sees 3 pending';
  perform public.mv_admin_review_idea((pend -> 0 ->> 'id')::bigint, 'live');
  assert (select count(*) from jsonb_array_elements(public.mv_priorities() -> 'ideas') e where e ->> 'kind' = 'community') = 1, 'approved idea is public';
  perform public.mv_admin_announce('First message', 'Welcome to the movement.');
end $$;
select pg_temp.as_user('cat'); select pg_temp.clear_rl();
do $$ declare d jsonb; begin   -- approved community idea is votable; Cat already voted → one vote per round
  begin perform public.mv_cast_vote((select id from public.mv_ideas where kind = 'community' and status = 'live')); raise exception 'FAIL second vote in round';
  exception when sqlstate '22023' then null; end;
  d := public.mv_my_dashboard();
  assert jsonb_array_length(d -> 'announcements') >= 1 and d -> 'announcements' -> 0 ->> 'kind' is not null, 'announcements reach the dashboard';
end $$;

-- 8. dashboard + referral stats ------------------------------------------------------------------------------------------
select pg_temp.as_user('ana');
do $$ declare d jsonb; begin
  d := public.mv_my_dashboard();
  assert (d -> 'profile' ->> 'founding_number')::int = 1 and (d -> 'profile' ->> 'is_founding')::boolean, 'founding status';
  assert (d -> 'country' ->> 'rank')::int = 1 and (d -> 'country' ->> 'contributors')::int = 2, 'country standing';
  assert (d -> 'referral' ->> 'successful')::int = 1 and (d -> 'referral' ->> 'rank')::int = 1, 'one successful referral, rank 1';
  assert d -> 'referral' -> 'by_country' -> 0 ->> 'code' = 'GB', 'referral country contribution';
  assert (d -> 'referral' ->> 'invites')::int = 0, 'no invitations yet';
  assert public.mv_log_invite('whatsapp') = 1 and public.mv_log_invite('copy') = 2, 'invites counted';
  begin perform public.mv_log_invite('telegram'); raise exception 'FAIL channel'; exception when sqlstate '22023' then null; end;
  assert (public.mv_my_dashboard() -> 'referral' ->> 'invites')::int = 2, 'dashboard shows 2 invites';
end $$;

-- 9. profile update moves the counters with the person ---------------------------------------------------------------------
select pg_temp.clear_rl();
do $$ declare d jsonb; begin
  d := public.mv_update_profile('Ana Byrne', null, 'AU', false);
  assert (d -> 'country' ->> 'code') = 'AU' and (d -> 'profile' ->> 'marketing_consent')::boolean = false, 'country + consent changed';
  assert pg_temp.cc('IE') = 1, 'IE decremented';
  assert pg_temp.cc('AU') = 1, 'AU incremented';
  assert (select marketing_consent_at from public.mv_profiles) is not null, 'consent change timestamped';
  begin perform public.mv_update_profile('Ana', null, 'ZZ', false); raise exception 'FAIL bad country'; exception when sqlstate '22023' then null; end;
  assert (public.mv_public_stats() ->> 'contributors')::int = 3, 'total unchanged by a country move';
end $$;

-- 10. milestones are only ever written when genuinely reached --------------------------------------------------------------------
reset role;
do $$ begin
  assert (select count(*) from public.mv_milestones where scope = 'global') = 0, '3 contributors: no global milestone';
  -- simulate crossing 100 genuinely: 97 more confirmed signups
  insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
    select 'bulk' || g || '@example.com', now(), '{"mv":"1","full_name":"Bulk","country":"CA","terms":"1"}'::jsonb from generate_series(1, 97) g;
  assert (select value from public.mv_counters where key = 'contributors') = 100, '100 contributors';
  assert exists (select 1 from public.mv_milestones where scope = 'global' and threshold = 100), 'global 100 reached';
  assert not exists (select 1 from public.mv_milestones where scope = 'global' and threshold = 1000), '1,000 not invented';
  assert exists (select 1 from public.mv_milestones where scope = 'CA' and threshold = 10) and not exists (select 1 from public.mv_milestones where scope = 'CA' and threshold = 100), 'CA 10 reached, 100 not';
  assert (select max(founding_number) from public.mv_profiles) = 100 and (select count(distinct founding_number) from public.mv_profiles where founding_number is not null) = 100, 'numbers unique and gapless';
end $$;

-- 11. counters can always be rebuilt from source rows --------------------------------------------------------------------------------
do $$ declare a bigint; b jsonb; begin
  select value into a from public.mv_counters where key = 'contributors';
  select jsonb_agg(jsonb_build_array(country_code, n) order by country_code) into b from public.mv_country_counts;
  perform public.mv_recount();
  assert (select value from public.mv_counters where key = 'contributors') = a, 'contributors survive recount';
  assert (select jsonb_agg(jsonb_build_array(country_code, n) order by country_code) from public.mv_country_counts) = b, 'country counts survive recount';
  assert (select sum(vote_count) from public.mv_ideas) = (select count(*) from public.mv_votes), 'vote counters survive recount';
end $$;

-- 12. GDPR: export, then erasure ---------------------------------------------------------------------------------------------------------
set role authenticated; select pg_temp.as_user('bob'); select pg_temp.clear_rl();
do $$ declare e jsonb; x jsonb; begin
  e := public.mv_export_my_data();
  assert e ->> 'account_email' = 'bob@example.com' and e -> 'profile' ->> 'full_name' = 'Bob Smith' and (e ->> 'referred_by_someone')::boolean, 'export contains own data';
  assert e::text not like '%Byrne%' and e::text not like '%cat@example.com%', 'export contains nobody else''s data';
  x := public.mv_delete_account();
  assert (x ->> 'deleted')::boolean and (x ->> 'login_removed')::boolean, 'erased';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where email = 'bob@example.com'), 'login removed';
  assert not exists (select 1 from public.mv_profiles where full_name = 'Bob Smith'), 'profile removed';
  assert not exists (select 1 from public.mv_referrals where referred_id = (select id from u where k = 'bob')), 'referral row removed';
  assert (select n from public.mv_country_counts where country_code = 'GB') = 0, 'GB count decremented';
  assert (select value from public.mv_counters where key = 'contributors') = 99, 'total decremented';
  assert not exists (select 1 from public.mv_ideas where author_id is not null and status = 'pending' and title like 'Ocean%'), 'pending ideas deleted with account';
  assert exists (select 1 from public.mv_ideas where kind = 'community' and status = 'live' and author_id is null), 'approved idea survives, anonymised';
  assert exists (select 1 from public.mv_milestones where scope = 'global' and threshold = 100), 'history of milestones is kept';
end $$;

-- shared Supabase Auth: a user of another product keeps their login, loses only movement data
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values ('77777777-0000-0000-0000-000000000009', 'both@example.com', now(), '{"mv":"1","full_name":"Both","country":"FR","terms":"1"}');
insert into public.rtt_profiles (parent_id) values ('77777777-0000-0000-0000-000000000009');
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-000000000009', false); select pg_temp.clear_rl();
do $$ begin assert not (public.mv_delete_account() ->> 'login_removed')::boolean, 'login kept for shared account'; end $$;
reset role;
do $$ begin
  assert exists (select 1 from auth.users where id = '77777777-0000-0000-0000-000000000009'), 'shared login survives';
  assert not exists (select 1 from public.mv_profiles where user_id = '77777777-0000-0000-0000-000000000009'), 'movement profile erased';
end $$;

-- 13. an existing account without a profile can join (mv_join), and can't join twice
set role authenticated; select pg_temp.as_user('rtt'); select pg_temp.clear_rl();
do $$ declare d jsonb; begin
  d := public.mv_join('Rita Tutor', 'Rita', 'DE', true, null, true);
  assert (d -> 'profile' ->> 'founding_number') is not null and d -> 'country' ->> 'code' = 'DE', 'mv_join creates + confirms';
  d := public.mv_join('Rita Tutor', 'Rita', 'DE', true, null, true);   -- idempotent
  assert (select count(*) from public.mv_profiles where user_id = (select id from u where k = 'rtt')) = 1, 'no duplicate profile';
  begin perform public.mv_join('X', null, 'DE', false, null, false); exception when sqlstate '22023' then null; end;
end $$;

-- 14. rate limiting bites ----------------------------------------------------------------------------------------------------------------------------
select pg_temp.clear_rl();
do $$ declare n int := 0; begin
  for i in 1..130 loop
    begin perform public.mv_ref_landing('0000000000'); exception when sqlstate '54000' then n := n + 1; end;
  end loop;
  assert n = 10, 'ref landing limited to 120/hour, blocked ' || n;
end $$;

-- 15. housekeeping removes only stale, unconfirmed contributor sign-ups
reset role;
insert into auth.users (id, email, created_at, raw_user_meta_data) values
  ('88888888-0000-0000-0000-000000000001', 'stale@example.com', now() - interval '40 days', '{"mv":"1","full_name":"Stale","country":"IE","terms":"1"}'),
  ('88888888-0000-0000-0000-000000000002', 'fresh@example.com', now() - interval '2 days',  '{"mv":"1","full_name":"Fresh","country":"IE","terms":"1"}');
do $$ begin
  assert public.mv_purge_unconfirmed(30) = 1, 'one stale unconfirmed sign-up purged';
  assert exists (select 1 from auth.users where email = 'fresh@example.com') and not exists (select 1 from auth.users where email = 'stale@example.com'), 'fresh kept, stale gone';
  assert exists (select 1 from auth.users where email = 'rtt@example.com'), 'other products untouched';
end $$;
set role anon;
do $$ begin begin perform public.mv_purge_unconfirmed(); raise exception 'FAIL anon purge'; exception when insufficient_privilege then null; end; end $$;

select 'mv db tests passed' as result;
