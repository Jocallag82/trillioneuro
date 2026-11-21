-- ════════════════════════════════════════════════════════════════════════════
--  TRILLION EURO — THE MOVEMENT (phase 1: community, countries, priorities, invitations)
--
--  Free registration only. No payments, pledges, donations or investments exist in this
--  schema. Everything is `mv_*`-prefixed and additive: the retired Beat Elon tables (`te_*`)
--  are left untouched.
--
--  Depends on (already present in the shared project): public.clean_text, public.rl_allow,
--  public.te_countries, public.te_admins/te_is_admin, and Supabase Auth (auth.users).
--
--  Security model
--    • No table is writable by anon/authenticated. Every write is a SECURITY DEFINER function with a
--      pinned search_path that validates, sanitises and rate-limits server-side.
--    • Personal data (name, email, consent, referral rows) is readable only by its owner (RLS) — the
--      public sees aggregates only, through functions that return counts, never rows.
--    • One vote per user per round is a primary key, not an `if`.
--    • Referral attribution is written once, by the database, at account creation.
--    • Counters are maintained by triggers inside the same transaction as the row they count.
--  Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Settings ────────────────────────────────────────────────────────────────
create table if not exists public.mv_settings (
  key   text primary key,
  value text not null
);
alter table public.mv_settings enable row level security;
revoke all on public.mv_settings from anon, authenticated;
insert into public.mv_settings (key, value) values
  ('founding_limit', '10000'),          -- the first N confirmed contributors are recorded as Founding Contributors
  ('terms_version',  '2026-11-21')
on conflict (key) do nothing;

-- ── Countries (own copy: stable slugs, decoupled from the retired te_* tables) ──
create or replace function public.mv_slug(p text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select btrim(regexp_replace(lower(translate(coalesce(p, ''),
    'ÅåÇçÉéÈèÊêËëÍíÎîÓóÔôÖöÚúÜüÑñÃãÕõÄäÝýÁáÀà',
    'AaCcEeEeEeEeIiIiOoOoOoUuUuNnAaOoAaYyAaAa')), '[^a-z0-9]+', '-', 'g'), '-')
$$;

create table if not exists public.mv_countries (
  code       text primary key check (code ~ '^[A-Z]{2}$'),
  slug       text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name       text not null,
  region     text,
  lat        numeric,
  lng        numeric,
  population bigint
);
alter table public.mv_countries enable row level security;
drop policy if exists mv_countries_read on public.mv_countries;
create policy mv_countries_read on public.mv_countries for select to anon, authenticated using (true);
revoke all on public.mv_countries from anon, authenticated;
grant select on public.mv_countries to anon, authenticated;

insert into public.mv_countries (code, slug, name, region, lat, lng, population)
select code, public.mv_slug(name), name, region, lat, lng, population
from public.te_countries where active
on conflict (code) do nothing;

-- ── Counters (written only by triggers/functions) ───────────────────────────
create table if not exists public.mv_counters (
  key   text primary key,
  value bigint not null default 0
);
alter table public.mv_counters enable row level security;
revoke all on public.mv_counters from anon, authenticated;
insert into public.mv_counters (key, value) values ('contributors', 0), ('founding_seq', 0)
on conflict (key) do nothing;

create table if not exists public.mv_country_counts (
  country_code text primary key references public.mv_countries (code),
  n            integer not null default 0 check (n >= 0)
);
alter table public.mv_country_counts enable row level security;
revoke all on public.mv_country_counts from anon, authenticated;

-- ── Contributor profiles ────────────────────────────────────────────────────
create table if not exists public.mv_profiles (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  full_name            text not null check (char_length(full_name) between 1 and 80),
  display_name         text check (display_name is null or char_length(display_name) between 1 and 40),
  country_code         text not null references public.mv_countries (code),
  referral_code        text not null unique check (referral_code ~ '^[0-9a-f]{10}$'),
  founding_number      integer unique check (founding_number > 0),
  confirmed_at         timestamptz,                       -- email confirmed: counts, votes, ranks only from here
  marketing_consent    boolean not null default false,
  marketing_consent_at timestamptz,
  terms_accepted_at    timestamptz not null default now(),
  terms_version        text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.mv_profiles enable row level security;
create index if not exists mv_profiles_country_idx   on public.mv_profiles (country_code) where confirmed_at is not null;
create index if not exists mv_profiles_confirmed_idx on public.mv_profiles (confirmed_at) where confirmed_at is not null;
drop policy if exists mv_profiles_own on public.mv_profiles;
create policy mv_profiles_own on public.mv_profiles for select to authenticated using (user_id = auth.uid());
revoke all on public.mv_profiles from anon, authenticated;
grant select on public.mv_profiles to authenticated;

-- ── Voting: rounds, ideas, votes ────────────────────────────────────────────
create table if not exists public.mv_rounds (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  title       text not null,
  description text,
  status      text not null default 'open' check (status in ('upcoming', 'open', 'closed')),
  opens_at    timestamptz not null default now(),
  closes_at   timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.mv_rounds enable row level security;
drop policy if exists mv_rounds_read on public.mv_rounds;
create policy mv_rounds_read on public.mv_rounds for select to anon, authenticated using (true);
revoke all on public.mv_rounds from anon, authenticated;
grant select on public.mv_rounds to anon, authenticated;

create table if not exists public.mv_ideas (
  id         bigint generated always as identity primary key,
  round_id   bigint not null references public.mv_rounds (id) on delete cascade,
  slug       text not null unique,
  title      text not null check (char_length(title) between 3 and 80),
  summary    text not null check (char_length(summary) between 10 and 400),
  kind       text not null default 'community' check (kind in ('seed', 'community')),
  art_key    text,
  status     text not null default 'pending' check (status in ('pending', 'live', 'rejected')),
  author_id  uuid references auth.users (id) on delete set null,
  vote_count integer not null default 0 check (vote_count >= 0),
  created_at timestamptz not null default now()
);
alter table public.mv_ideas enable row level security;
create index if not exists mv_ideas_round_idx  on public.mv_ideas (round_id, status);
create index if not exists mv_ideas_author_idx on public.mv_ideas (author_id) where author_id is not null;
drop policy if exists mv_ideas_live on public.mv_ideas;
create policy mv_ideas_live on public.mv_ideas for select to anon, authenticated using (status = 'live');
revoke all on public.mv_ideas from anon, authenticated;
grant select (id, round_id, slug, title, summary, kind, art_key, status, vote_count, created_at) on public.mv_ideas to anon, authenticated;

create table if not exists public.mv_votes (
  round_id   bigint not null references public.mv_rounds (id) on delete cascade,
  user_id    uuid   not null references auth.users (id) on delete cascade,
  idea_id    bigint not null references public.mv_ideas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (round_id, user_id)                          -- one vote per user per round, enforced by the database
);
alter table public.mv_votes enable row level security;
create index if not exists mv_votes_idea_idx on public.mv_votes (idea_id);
drop policy if exists mv_votes_own on public.mv_votes;
create policy mv_votes_own on public.mv_votes for select to authenticated using (user_id = auth.uid());
revoke all on public.mv_votes from anon, authenticated;
grant select on public.mv_votes to authenticated;

-- ── Referrals & invitations ─────────────────────────────────────────────────
-- One row per referred person (PK on referred_id → attributed exactly once, never re-pointed).
create table if not exists public.mv_referrals (
  referred_id  uuid primary key references auth.users (id) on delete cascade,
  referrer_id  uuid not null references auth.users (id) on delete cascade,
  country_code text references public.mv_countries (code),
  created_at   timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
alter table public.mv_referrals enable row level security;
create index if not exists mv_referrals_referrer_idx on public.mv_referrals (referrer_id);
drop policy if exists mv_referrals_own on public.mv_referrals;
create policy mv_referrals_own on public.mv_referrals for select to authenticated using (referrer_id = auth.uid());
revoke all on public.mv_referrals from anon, authenticated;
grant select on public.mv_referrals to authenticated;

-- Share actions by the signed-in contributor ("invitations generated"). Private to the owner and never ranked.
create table if not exists public.mv_invites (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  channel    text not null check (channel in ('whatsapp', 'facebook', 'linkedin', 'x', 'copy', 'native', 'card')),
  created_at timestamptz not null default now()
);
alter table public.mv_invites enable row level security;
create index if not exists mv_invites_user_idx on public.mv_invites (user_id, created_at desc);
drop policy if exists mv_invites_own on public.mv_invites;
create policy mv_invites_own on public.mv_invites for select to authenticated using (user_id = auth.uid());
revoke all on public.mv_invites from anon, authenticated;
grant select on public.mv_invites to authenticated;

-- ── Announcements & milestones ──────────────────────────────────────────────
create table if not exists public.mv_announcements (
  id           bigint generated always as identity primary key,
  title        text not null check (char_length(title) between 3 and 120),
  body         text not null check (char_length(body) between 3 and 2000),
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.mv_announcements enable row level security;
drop policy if exists mv_announcements_read on public.mv_announcements;
create policy mv_announcements_read on public.mv_announcements for select to anon, authenticated using (published);
revoke all on public.mv_announcements from anon, authenticated;
grant select on public.mv_announcements to anon, authenticated;

-- A row exists only once the threshold has genuinely been crossed (written by the confirm trigger).
create table if not exists public.mv_milestones (
  scope      text    not null,                              -- 'global' or an ISO country code
  threshold  integer not null,
  reached_at timestamptz not null default now(),
  primary key (scope, threshold)
);
alter table public.mv_milestones enable row level security;
drop policy if exists mv_milestones_read on public.mv_milestones;
create policy mv_milestones_read on public.mv_milestones for select to anon, authenticated using (true);
revoke all on public.mv_milestones from anon, authenticated;
grant select on public.mv_milestones to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  Internal helpers (not callable by clients)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.mv_setting(p_key text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select value from public.mv_settings where key = p_key
$$;
revoke all on function public.mv_setting(text) from public, anon, authenticated;

create or replace function public.mv_require_user() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED: Please sign in first.' using errcode = '42501';
  end if;
  return auth.uid();
end $$;
revoke all on function public.mv_require_user() from public, anon, authenticated;

create or replace function public.mv_require_admin() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not coalesce(public.te_is_admin(), false) then
    raise exception 'FORBIDDEN: administrator access required' using errcode = '42501';
  end if;
  return auth.uid();
end $$;
revoke all on function public.mv_require_admin() from public, anon, authenticated;

-- Genuine milestones: only thresholds the real count has reached.
create or replace function public.mv_record_milestones(p_scope text, p_count bigint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare t integer;
begin
  for t in select unnest(case when p_scope = 'global'
                               then array[100, 1000, 10000, 100000, 1000000]
                               else array[10, 100, 1000, 10000, 100000] end) loop
    if p_count >= t then
      insert into public.mv_milestones (scope, threshold) values (p_scope, t) on conflict do nothing;
    end if;
  end loop;
end $$;
revoke all on function public.mv_record_milestones(text, bigint) from public, anon, authenticated;

create or replace function public.mv_country_add(p_code text, p_delta integer) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n integer;
begin
  insert into public.mv_country_counts (country_code, n) values (p_code, greatest(p_delta, 0))
  on conflict (country_code) do update set n = greatest(public.mv_country_counts.n + p_delta, 0)
  returning n into v_n;
  if p_delta > 0 then perform public.mv_record_milestones(p_code, v_n); end if;
end $$;
revoke all on function public.mv_country_add(text, integer) from public, anon, authenticated;

-- Confirms a contributor (email verified): founding number, counters, milestones. Idempotent.
-- Lock order everywhere: profile row → counters row.
create or replace function public.mv_confirm_profile(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cc text; v_seq bigint; v_total bigint;
begin
  select country_code into v_cc from public.mv_profiles
   where user_id = p_user and confirmed_at is null for update;
  if not found then return; end if;

  update public.mv_counters set value = value + 1 where key = 'founding_seq' returning value into v_seq;
  update public.mv_counters set value = value + 1 where key = 'contributors' returning value into v_total;
  update public.mv_profiles set confirmed_at = now(), founding_number = v_seq, updated_at = now() where user_id = p_user;
  perform public.mv_country_add(v_cc, 1);
  perform public.mv_record_milestones('global', v_total);
end $$;
revoke all on function public.mv_confirm_profile(uuid) from public, anon, authenticated;

-- Shared by the auth trigger and by mv_join (for an existing account with no profile yet).
create or replace function public.mv_create_profile(p_user uuid, p_meta jsonb, p_confirmed boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name text := left(public.clean_text(p_meta ->> 'full_name'), 80);
  v_disp text := left(public.clean_text(p_meta ->> 'display_name'), 40);
  v_cc   text := upper(btrim(coalesce(p_meta ->> 'country', '')));
  v_ref  text := lower(btrim(coalesce(p_meta ->> 'ref', '')));
  v_marketing boolean := coalesce((p_meta ->> 'marketing') = '1', false);
  v_referrer uuid; v_code text; v_try integer := 0;
begin
  if coalesce(p_meta ->> 'hp', '') <> '' then
    raise exception 'REJECTED: Registration could not be completed.' using errcode = '22023';
  end if;
  if v_name is null then raise exception 'NAME_REQUIRED: Please enter your name.' using errcode = '22023'; end if;
  if not exists (select 1 from public.mv_countries where code = v_cc) then
    raise exception 'COUNTRY_INVALID: Please choose your country.' using errcode = '22023';
  end if;
  if (p_meta ->> 'terms') is distinct from '1' then
    raise exception 'TERMS_REQUIRED: Please accept the terms and privacy notice.' using errcode = '22023';
  end if;
  if exists (select 1 from public.mv_profiles where user_id = p_user) then return; end if;

  if v_ref ~ '^[0-9a-f]{10}$' then
    select user_id into v_referrer from public.mv_profiles where referral_code = v_ref;
  end if;

  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    begin
      insert into public.mv_profiles (user_id, full_name, display_name, country_code, referral_code,
                                      marketing_consent, marketing_consent_at, terms_version)
      values (p_user, v_name, v_disp, v_cc, v_code, v_marketing,
              case when v_marketing then now() end, coalesce(public.mv_setting('terms_version'), 'unknown'));
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise; end if;
    end;
  end loop;

  if v_referrer is not null and v_referrer <> p_user then
    insert into public.mv_referrals (referred_id, referrer_id, country_code) values (p_user, v_referrer, v_cc)
    on conflict do nothing;
  end if;
  if p_confirmed then perform public.mv_confirm_profile(p_user); end if;
end $$;
revoke all on function public.mv_create_profile(uuid, jsonb, boolean) from public, anon, authenticated;

-- ── Auth triggers ───────────────────────────────────────────────────────────
-- Only sign-ups that carry mv=1 in their metadata become contributors, so users of the other
-- products that share this Supabase project are never touched.
create or replace function public.mv_on_auth_user_created() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'mv', '') = '1' then
    perform public.mv_create_profile(new.id, new.raw_user_meta_data, new.email_confirmed_at is not null);
  end if;
  return new;
end $$;
revoke all on function public.mv_on_auth_user_created() from public, anon, authenticated;

create or replace function public.mv_on_auth_user_confirmed() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.mv_confirm_profile(new.id);
  end if;
  return new;
end $$;
revoke all on function public.mv_on_auth_user_confirmed() from public, anon, authenticated;

drop trigger if exists mv_auth_user_created on auth.users;
create trigger mv_auth_user_created after insert on auth.users
  for each row execute function public.mv_on_auth_user_created();
drop trigger if exists mv_auth_user_confirmed on auth.users;
create trigger mv_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.mv_on_auth_user_confirmed();

-- Keep counters honest when a confirmed profile is removed (account deletion).
create or replace function public.mv_on_profile_deleted() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.confirmed_at is not null then
    update public.mv_counters set value = greatest(value - 1, 0) where key = 'contributors';
    perform public.mv_country_add(old.country_code, -1);
  end if;
  return old;
end $$;
revoke all on function public.mv_on_profile_deleted() from public, anon, authenticated;
drop trigger if exists mv_profile_deleted on public.mv_profiles;
create trigger mv_profile_deleted after delete on public.mv_profiles
  for each row execute function public.mv_on_profile_deleted();

-- Per-idea vote counter, in the same transaction as the vote.
create or replace function public.mv_on_vote_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    update public.mv_ideas set vote_count = vote_count + 1 where id = new.idea_id;
    return new;
  end if;
  update public.mv_ideas set vote_count = greatest(vote_count - 1, 0) where id = old.idea_id;
  return old;
end $$;
revoke all on function public.mv_on_vote_change() from public, anon, authenticated;
drop trigger if exists mv_vote_change on public.mv_votes;
create trigger mv_vote_change after insert or delete on public.mv_votes
  for each row execute function public.mv_on_vote_change();

-- Repair tool: recompute every counter from source rows (service role / SQL editor only).
create or replace function public.mv_recount() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.mv_counters set value = (select count(*) from public.mv_profiles where confirmed_at is not null) where key = 'contributors';
  delete from public.mv_country_counts;
  insert into public.mv_country_counts (country_code, n)
    select country_code, count(*) from public.mv_profiles where confirmed_at is not null group by 1;
  update public.mv_ideas i set vote_count = (select count(*) from public.mv_votes v where v.idea_id = i.id);
end $$;
revoke all on function public.mv_recount() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  Seed: the founding round and the seven starting priorities
-- ════════════════════════════════════════════════════════════════════════════
insert into public.mv_rounds (slug, title, description)
values ('founding-priorities', 'Founding priorities',
        'What should the movement tackle first? One vote per contributor. It sets the community''s direction — it is not a financial commitment.')
on conflict (slug) do nothing;

insert into public.mv_ideas (round_id, slug, title, summary, kind, art_key, status)
select r.id, v.slug, v.title, v.summary, 'seed', v.slug, 'live'
from public.mv_rounds r, (values
  ('clean-water',   'Clean water and sanitation',       'Safe drinking water and working sanitation for every community that still goes without.'),
  ('poverty-hunger','Poverty and hunger',               'Making sure no family has to choose between food, shelter and a future.'),
  ('healthcare',    'Healthcare and medical research',  'Care within reach for everyone, and the research that turns today''s diseases into history.'),
  ('education',     'Education and opportunity',        'A real chance to learn, build and earn — wherever a child happens to be born.'),
  ('climate',       'Climate and environmental restoration', 'Restoring forests, oceans and soils, and cutting the emissions that put them at risk.'),
  ('science-tech',  'Scientific innovation and technology', 'Backing the breakthroughs — energy, materials, computing — that lift everyone at once.'),
  ('housing',       'Housing and basic infrastructure', 'A safe home, reliable power, roads and connectivity for people who have none.')
) as v(slug, title, summary)
where r.slug = 'founding-priorities'
on conflict (slug) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
--  Public read API (aggregates only — no personal data)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.mv_public_stats() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_contrib bigint; v_seq bigint; v_limit integer; v_next integer;
begin
  select value into v_contrib from public.mv_counters where key = 'contributors';
  select value into v_seq     from public.mv_counters where key = 'founding_seq';
  v_limit := coalesce(public.mv_setting('founding_limit')::integer, 10000);
  select min(t) into v_next from unnest(array[100, 1000, 10000, 100000, 1000000]) t where t > v_contrib;
  return jsonb_build_object(
    'contributors', coalesce(v_contrib, 0),
    'countries',    (select count(*) from public.mv_country_counts where n > 0),
    'ideas',        (select count(*) from public.mv_ideas where kind = 'community' and status in ('pending', 'live')),
    'votes',        (select coalesce(sum(vote_count), 0) from public.mv_ideas),
    'founding_limit',     v_limit,
    'founding_remaining', greatest(v_limit - coalesce(v_seq, 0), 0),
    'next_milestone',     v_next,
    'milestones', coalesce((select jsonb_agg(jsonb_build_object('threshold', threshold, 'reached_at', reached_at) order by threshold)
                              from public.mv_milestones where scope = 'global'), '[]'::jsonb)
  );
end $$;
revoke all on function public.mv_public_stats() from public;
grant execute on function public.mv_public_stats() to anon, authenticated;

create or replace function public.mv_country_board() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_total bigint;
begin
  select coalesce(sum(n), 0) into v_total from public.mv_country_counts;
  return coalesce((
    with growth as (
      select country_code, count(*) g from public.mv_profiles
       where confirmed_at > now() - interval '7 days' group by 1),
    ranked as (
      select c.code, c.slug, c.name, c.region, c.lat, c.lng, coalesce(cc.n, 0) n, coalesce(g.g, 0) g,
             case when coalesce(cc.n, 0) > 0 then rank() over (order by coalesce(cc.n, 0) desc) end rk
        from public.mv_countries c
        left join public.mv_country_counts cc on cc.country_code = c.code
        left join growth g on g.country_code = c.code)
    select jsonb_agg(jsonb_build_object(
             'code', code, 'slug', slug, 'name', name, 'region', region, 'lat', lat, 'lng', lng,
             'contributors', n, 'rank', rk, 'growth_7d', g,
             'pct', case when v_total > 0 then round(n * 100.0 / v_total, 2) else 0 end)
           order by n desc, name)
      from ranked), '[]'::jsonb);
end $$;
revoke all on function public.mv_country_board() from public;
grant execute on function public.mv_country_board() to anon, authenticated;

create or replace function public.mv_country(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.mv_countries; v_n integer; v_rank integer; v_total bigint; v_votes bigint;
begin
  select * into c from public.mv_countries where slug = lower(btrim(coalesce(p_slug, '')));
  if not found then return null; end if;
  select coalesce(n, 0) into v_n from public.mv_country_counts where country_code = c.code;
  v_n := coalesce(v_n, 0);
  select coalesce(sum(n), 0) into v_total from public.mv_country_counts;
  if v_n > 0 then
    select 1 + count(*) into v_rank from public.mv_country_counts where n > v_n;
  end if;
  select count(*) into v_votes from public.mv_votes v join public.mv_profiles p on p.user_id = v.user_id
   where p.country_code = c.code and p.confirmed_at is not null;
  return jsonb_build_object(
    'code', c.code, 'slug', c.slug, 'name', c.name, 'region', c.region, 'lat', c.lat, 'lng', c.lng,
    'contributors', v_n, 'rank', v_rank,
    'countries_with_contributors', (select count(*) from public.mv_country_counts where n > 0),
    'pct', case when v_total > 0 then round(v_n * 100.0 / v_total, 2) else 0 end,
    'growth_7d',  (select count(*) from public.mv_profiles where country_code = c.code and confirmed_at > now() - interval '7 days'),
    'growth_30d', (select count(*) from public.mv_profiles where country_code = c.code and confirmed_at > now() - interval '30 days'),
    'votes_cast', v_votes,
    'series', coalesce((
        select jsonb_agg(jsonb_build_object('d', to_char(d.day, 'YYYY-MM-DD'), 'n', coalesce(x.n, 0)) order by d.day)
          from generate_series((now() at time zone 'utc')::date - 13, (now() at time zone 'utc')::date, interval '1 day') d(day)
          left join (select (confirmed_at at time zone 'utc')::date as dy, count(*) n from public.mv_profiles
                      where country_code = c.code and confirmed_at > now() - interval '15 days' group by 1) x on x.dy = d.day::date), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(jsonb_build_object('threshold', threshold, 'reached_at', reached_at) order by threshold)
                              from public.mv_milestones where scope = c.code), '[]'::jsonb)
  );
end $$;
revoke all on function public.mv_country(text) from public;
grant execute on function public.mv_country(text) to anon, authenticated;

create or replace function public.mv_priorities() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.mv_rounds; v_total bigint; v_mine bigint;
begin
  select * into r from public.mv_rounds where status = 'open' order by opens_at desc limit 1;
  if not found then return jsonb_build_object('round', null, 'ideas', '[]'::jsonb, 'total_votes', 0, 'my_vote', null); end if;
  select coalesce(sum(vote_count), 0) into v_total from public.mv_ideas where round_id = r.id and status = 'live';
  select idea_id into v_mine from public.mv_votes where round_id = r.id and user_id = auth.uid();
  return jsonb_build_object(
    'round', jsonb_build_object('id', r.id, 'slug', r.slug, 'title', r.title, 'description', r.description, 'closes_at', r.closes_at),
    'total_votes', v_total,
    'my_vote', v_mine,
    'ideas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'slug', i.slug, 'title', i.title, 'summary', i.summary, 'kind', i.kind, 'art_key', i.art_key,
        'votes', i.vote_count,
        'pct', case when v_total > 0 then round(i.vote_count * 100.0 / v_total, 1) else 0 end)
        order by (i.kind = 'seed') desc, i.vote_count desc, i.id)
      from public.mv_ideas i where i.round_id = r.id and i.status = 'live'), '[]'::jsonb));
end $$;
revoke all on function public.mv_priorities() from public;
grant execute on function public.mv_priorities() to anon, authenticated;

-- Personalises an invitation link ("<display name> invited you"). Only the optional, user-chosen display name is returned.
create or replace function public.mv_ref_landing(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p public.mv_profiles; v_cc text;
begin
  if not public.rl_allow('mv_ref_landing', 120, interval '1 hour') then
    raise exception 'RATE_LIMIT: Too many requests.' using errcode = '54000';
  end if;
  select * into p from public.mv_profiles
   where referral_code = lower(btrim(coalesce(p_code, ''))) and confirmed_at is not null;
  if not found then return jsonb_build_object('valid', false); end if;
  select name into v_cc from public.mv_countries where code = p.country_code;
  return jsonb_build_object('valid', true, 'display_name', p.display_name, 'country', v_cc, 'country_code', p.country_code);
end $$;
revoke all on function public.mv_ref_landing(text) from public;
grant execute on function public.mv_ref_landing(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  Contributor API (authenticated)
-- ════════════════════════════════════════════════════════════════════════════
-- For accounts that exist (e.g. from another product) but have no contributor profile yet.
create or replace function public.mv_join(p_full_name text, p_display_name text, p_country text, p_marketing boolean,
                                          p_ref text, p_terms boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.mv_require_user(); v_confirmed boolean;
begin
  if not public.rl_allow('mv_join', 10, interval '1 hour') then
    raise exception 'RATE_LIMIT: Too many attempts. Please wait and try again.' using errcode = '54000';
  end if;
  select email_confirmed_at is not null into v_confirmed from auth.users where id = v_uid;
  perform public.mv_create_profile(v_uid, jsonb_build_object(
    'full_name', p_full_name, 'display_name', p_display_name, 'country', p_country,
    'marketing', case when p_marketing then '1' else '0' end, 'ref', p_ref, 'terms', case when p_terms then '1' else '0' end),
    coalesce(v_confirmed, false));
  return public.mv_my_dashboard();
end $$;
revoke all on function public.mv_join(text, text, text, boolean, text, boolean) from public, anon;
grant execute on function public.mv_join(text, text, text, boolean, text, boolean) to authenticated;

create or replace function public.mv_my_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := public.mv_require_user(); p public.mv_profiles; v_n integer; v_rank integer; v_total bigint;
  v_limit integer := coalesce(public.mv_setting('founding_limit')::integer, 10000);
  v_succ integer; v_all integer; v_myrank integer; v_vote jsonb;
begin
  select * into p from public.mv_profiles where user_id = v_uid;
  if not found then return jsonb_build_object('has_profile', false); end if;
  select coalesce(n, 0) into v_n from public.mv_country_counts where country_code = p.country_code;
  v_n := coalesce(v_n, 0);
  select coalesce(sum(n), 0) into v_total from public.mv_country_counts;
  if v_n > 0 then select 1 + count(*) into v_rank from public.mv_country_counts where n > v_n; end if;

  select count(*) filter (where q.confirmed_at is not null), count(*)
    into v_succ, v_all
    from public.mv_referrals r join public.mv_profiles q on q.user_id = r.referred_id
   where r.referrer_id = v_uid;
  if v_succ > 0 then
    select 1 + count(*) into v_myrank from (
      select r.referrer_id from public.mv_referrals r join public.mv_profiles q on q.user_id = r.referred_id and q.confirmed_at is not null
       group by r.referrer_id having count(*) > v_succ) x;
  end if;

  select jsonb_build_object('idea_id', i.id, 'title', i.title, 'voted_at', v.created_at) into v_vote
    from public.mv_votes v join public.mv_ideas i on i.id = v.idea_id
   where v.user_id = v_uid order by v.created_at desc limit 1;

  return jsonb_build_object(
    'has_profile', true,
    'profile', jsonb_build_object(
      'full_name', p.full_name, 'display_name', p.display_name, 'country_code', p.country_code,
      'confirmed', p.confirmed_at is not null, 'founding_number', p.founding_number,
      'is_founding', p.founding_number is not null and p.founding_number <= v_limit,
      'joined_at', coalesce(p.confirmed_at, p.created_at), 'marketing_consent', p.marketing_consent),
    'country', (select jsonb_build_object('code', c.code, 'slug', c.slug, 'name', c.name, 'contributors', v_n, 'rank', v_rank,
                  'pct', case when v_total > 0 then round(v_n * 100.0 / v_total, 2) else 0 end)
                  from public.mv_countries c where c.code = p.country_code),
    'global', jsonb_build_object('contributors', (select value from public.mv_counters where key = 'contributors'),
                                 'countries', (select count(*) from public.mv_country_counts where n > 0)),
    'my_vote', v_vote,
    'my_ideas', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'status', status, 'votes', vote_count, 'created_at', created_at)
                                           order by created_at desc) from public.mv_ideas where author_id = v_uid), '[]'::jsonb),
    'referral', jsonb_build_object(
      'code', p.referral_code,
      'invites', (select count(*) from public.mv_invites where user_id = v_uid),
      'registered', v_all, 'successful', v_succ, 'rank', v_myrank,
      'by_country', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'n', n) order by n desc) from (
          select c.code, c.name, count(*) n from public.mv_referrals r
            join public.mv_profiles q on q.user_id = r.referred_id and q.confirmed_at is not null
            join public.mv_countries c on c.code = q.country_code
           where r.referrer_id = v_uid group by c.code, c.name) z), '[]'::jsonb)),
    'announcements', coalesce((select jsonb_agg(u.a order by u.at desc) from (
        select * from (
          select jsonb_build_object('kind', 'announcement', 'title', title, 'body', body, 'at', published_at) a, published_at at
            from public.mv_announcements where published
          union all
          select jsonb_build_object('kind', 'milestone', 'scope', scope, 'threshold', threshold, 'at', reached_at), reached_at
            from public.mv_milestones where scope = 'global' or scope = p.country_code) z
        order by at desc limit 8) u), '[]'::jsonb)
  );
end $$;
revoke all on function public.mv_my_dashboard() from public, anon;
grant execute on function public.mv_my_dashboard() to authenticated;

create or replace function public.mv_update_profile(p_full_name text, p_display_name text, p_country text, p_marketing boolean)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := public.mv_require_user(); p public.mv_profiles;
  v_name text := left(public.clean_text(p_full_name), 80);
  v_disp text := left(public.clean_text(p_display_name), 40);
  v_cc text := upper(btrim(coalesce(p_country, '')));
begin
  if not public.rl_allow('mv_update_profile', 30, interval '1 hour') then
    raise exception 'RATE_LIMIT: Too many attempts. Please wait and try again.' using errcode = '54000';
  end if;
  if v_name is null then raise exception 'NAME_REQUIRED: Please enter your name.' using errcode = '22023'; end if;
  if not exists (select 1 from public.mv_countries where code = v_cc) then
    raise exception 'COUNTRY_INVALID: Please choose your country.' using errcode = '22023';
  end if;
  select * into p from public.mv_profiles where user_id = v_uid for update;
  if not found then raise exception 'NO_PROFILE: Join the movement first.' using errcode = '22023'; end if;

  if p.country_code <> v_cc and p.confirmed_at is not null then
    perform public.mv_country_add(p.country_code, -1);
    perform public.mv_country_add(v_cc, 1);
  end if;
  update public.mv_profiles set
    full_name = v_name, display_name = v_disp, country_code = v_cc,
    marketing_consent = coalesce(p_marketing, false),
    marketing_consent_at = case when coalesce(p_marketing, false) is distinct from p.marketing_consent then now() else p.marketing_consent_at end,
    updated_at = now()
   where user_id = v_uid;
  return public.mv_my_dashboard();
end $$;
revoke all on function public.mv_update_profile(text, text, text, boolean) from public, anon;
grant execute on function public.mv_update_profile(text, text, text, boolean) to authenticated;

create or replace function public.mv_cast_vote(p_idea_id bigint) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.mv_require_user(); i public.mv_ideas; r public.mv_rounds;
begin
  if not public.rl_allow('mv_vote', 30, interval '1 hour') then
    raise exception 'RATE_LIMIT: Too many attempts. Please wait and try again.' using errcode = '54000';
  end if;
  if not exists (select 1 from public.mv_profiles where user_id = v_uid and confirmed_at is not null) then
    raise exception 'CONFIRM_REQUIRED: Confirm your email address to vote.' using errcode = '42501';
  end if;
  select * into i from public.mv_ideas where id = p_idea_id and status = 'live';
  if not found then raise exception 'IDEA_NOT_FOUND: That priority is not open for voting.' using errcode = '22023'; end if;
  select * into r from public.mv_rounds where id = i.round_id and status = 'open'
     and (closes_at is null or closes_at > now());
  if not found then raise exception 'ROUND_CLOSED: This voting round is closed.' using errcode = '22023'; end if;
  begin
    insert into public.mv_votes (round_id, user_id, idea_id) values (r.id, v_uid, i.id);
  exception when unique_violation then
    raise exception 'ALREADY_VOTED: You have already voted in this round.' using errcode = '22023';
  end;
  return public.mv_priorities();
end $$;
revoke all on function public.mv_cast_vote(bigint) from public, anon;
grant execute on function public.mv_cast_vote(bigint) to authenticated;

create or replace function public.mv_submit_idea(p_title text, p_summary text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := public.mv_require_user(); r public.mv_rounds;
  v_title text := left(public.clean_text(p_title), 80);
  v_sum   text := left(public.clean_text(p_summary), 400);
  v_slug text; v_id bigint;
begin
  if not public.rl_allow('mv_idea', 10, interval '1 hour') then
    raise exception 'RATE_LIMIT: Too many attempts. Please wait and try again.' using errcode = '54000';
  end if;
  if not exists (select 1 from public.mv_profiles where user_id = v_uid and confirmed_at is not null) then
    raise exception 'CONFIRM_REQUIRED: Confirm your email address to suggest a priority.' using errcode = '42501';
  end if;
  if v_title is null or char_length(v_title) < 6 then raise exception 'TITLE_TOO_SHORT: Give your idea a title of at least 6 characters.' using errcode = '22023'; end if;
  if v_sum is null or char_length(v_sum) < 20 then raise exception 'SUMMARY_TOO_SHORT: Describe it in at least 20 characters.' using errcode = '22023'; end if;
  if v_title ~* '(https?://|www\.)' or v_sum ~* '(https?://|www\.)' then
    raise exception 'NO_LINKS: Please describe the idea in words — links are not accepted.' using errcode = '22023';
  end if;
  select * into r from public.mv_rounds where status = 'open' order by opens_at desc limit 1;
  if not found then raise exception 'ROUND_CLOSED: There is no open voting round.' using errcode = '22023'; end if;
  if (select count(*) from public.mv_ideas where author_id = v_uid and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'DAILY_LIMIT: You can suggest up to 3 ideas a day.' using errcode = '54000';
  end if;
  if (select count(*) from public.mv_ideas where author_id = v_uid and status = 'pending') >= 5 then
    raise exception 'PENDING_LIMIT: You already have 5 ideas awaiting review.' using errcode = '54000';
  end if;
  if exists (select 1 from public.mv_ideas where round_id = r.id and lower(title) = lower(v_title) and status <> 'rejected') then
    raise exception 'DUPLICATE: Someone has already suggested that idea.' using errcode = '22023';
  end if;
  v_slug := public.mv_slug(v_title) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  insert into public.mv_ideas (round_id, slug, title, summary, kind, art_key, status, author_id)
  values (r.id, v_slug, v_title, v_sum, 'community', 'community', 'pending', v_uid) returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;
revoke all on function public.mv_submit_idea(text, text) from public, anon;
grant execute on function public.mv_submit_idea(text, text) to authenticated;

create or replace function public.mv_log_invite(p_channel text) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.mv_require_user();
begin
  if p_channel not in ('whatsapp', 'facebook', 'linkedin', 'x', 'copy', 'native', 'card') then
    raise exception 'CHANNEL_INVALID' using errcode = '22023';
  end if;
  if not public.rl_allow('mv_invite', 60, interval '1 hour') then
    raise exception 'RATE_LIMIT: Too many attempts.' using errcode = '54000';
  end if;
  insert into public.mv_invites (user_id, channel) values (v_uid, p_channel);
  return (select count(*) from public.mv_invites where user_id = v_uid);
end $$;
revoke all on function public.mv_log_invite(text) from public, anon;
grant execute on function public.mv_log_invite(text) to authenticated;

-- GDPR: access (art. 15 / 20) and erasure (art. 17), self-service.
create or replace function public.mv_export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.mv_require_user();
begin
  return jsonb_build_object(
    'exported_at', now(),
    'account_email', (select email from auth.users where id = v_uid),
    'profile', (select to_jsonb(p) - 'user_id' from public.mv_profiles p where user_id = v_uid),
    'votes',   coalesce((select jsonb_agg(jsonb_build_object('idea', i.title, 'voted_at', v.created_at))
                           from public.mv_votes v join public.mv_ideas i on i.id = v.idea_id where v.user_id = v_uid), '[]'::jsonb),
    'ideas',   coalesce((select jsonb_agg(jsonb_build_object('title', title, 'summary', summary, 'status', status, 'created_at', created_at))
                           from public.mv_ideas where author_id = v_uid), '[]'::jsonb),
    'invitations_shared', coalesce((select jsonb_agg(jsonb_build_object('channel', channel, 'at', created_at))
                           from public.mv_invites where user_id = v_uid), '[]'::jsonb),
    'people_referred', (select count(*) from public.mv_referrals where referrer_id = v_uid),
    'referred_by_someone', exists (select 1 from public.mv_referrals where referred_id = v_uid));
end $$;
revoke all on function public.mv_export_my_data() from public, anon;
grant execute on function public.mv_export_my_data() to authenticated;

create or replace function public.mv_delete_account() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := public.mv_require_user(); v_shared boolean := false;
begin
  if not public.rl_allow('mv_delete', 5, interval '1 hour') then
    raise exception 'RATE_LIMIT: Too many attempts.' using errcode = '54000';
  end if;
  -- unpublished ideas are removed; live ideas the community has voted on stay, anonymised (FK sets author_id null)
  delete from public.mv_ideas where author_id = v_uid and status <> 'live';
  delete from public.mv_votes where user_id = v_uid;
  delete from public.mv_invites where user_id = v_uid;
  delete from public.mv_referrals where referred_id = v_uid or referrer_id = v_uid;
  delete from public.mv_profiles where user_id = v_uid;
  -- Supabase Auth is shared with other products on this project: only remove the login if nothing else uses it.
  if to_regclass('public.rtt_profiles') is not null then
    execute 'select exists (select 1 from public.rtt_profiles where parent_id = $1)' into v_shared using v_uid;
  end if;
  if not v_shared then
    delete from auth.users where id = v_uid;
  end if;
  return jsonb_build_object('deleted', true, 'login_removed', not v_shared);
end $$;
revoke all on function public.mv_delete_account() from public, anon;
grant execute on function public.mv_delete_account() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  Administration (te_admins members only)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.mv_admin_pending_ideas() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.mv_require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'summary', summary, 'created_at', created_at) order by created_at)
                     from public.mv_ideas where status = 'pending'), '[]'::jsonb);
end $$;
revoke all on function public.mv_admin_pending_ideas() from public, anon;
grant execute on function public.mv_admin_pending_ideas() to authenticated;

create or replace function public.mv_admin_review_idea(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.mv_require_admin();
  if p_status not in ('live', 'rejected') then raise exception 'STATUS_INVALID' using errcode = '22023'; end if;
  update public.mv_ideas set status = p_status where id = p_id and kind = 'community';
end $$;
revoke all on function public.mv_admin_review_idea(bigint, text) from public, anon;
grant execute on function public.mv_admin_review_idea(bigint, text) to authenticated;

create or replace function public.mv_admin_announce(p_title text, p_body text) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  perform public.mv_require_admin();
  insert into public.mv_announcements (title, body, published, published_at)
  values (public.clean_text(p_title), public.clean_text(p_body), true, now()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.mv_admin_announce(text, text) from public, anon;
grant execute on function public.mv_admin_announce(text, text) to authenticated;

-- ── Sitemap feed: countries worth indexing (≥1 contributor) ─────────────────
create or replace function public.mv_sitemap() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(c.slug order by c.slug), '[]'::jsonb)
    from public.mv_countries c join public.mv_country_counts n on n.country_code = c.code and n.n > 0
$$;
revoke all on function public.mv_sitemap() from public;
grant execute on function public.mv_sitemap() to anon, authenticated;

-- ── Housekeeping: clear contributor sign-ups that never confirmed their email (privacy notice: "cleared periodically") ──
-- Service role / SQL editor only. Run it on a schedule you control, e.g. weekly:  select public.mv_purge_unconfirmed();
create or replace function public.mv_purge_unconfirmed(p_days integer default 30) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  with gone as (
    delete from auth.users u
     where u.email_confirmed_at is null
       and u.created_at < now() - make_interval(days => greatest(p_days, 7))
       and coalesce(u.raw_user_meta_data ->> 'mv', '') = '1'
       and exists (select 1 from public.mv_profiles p where p.user_id = u.id and p.confirmed_at is null)
    returning 1)
  select count(*) into n from gone;
  return n;
end $$;
revoke all on function public.mv_purge_unconfirmed(integer) from public, anon, authenticated;
