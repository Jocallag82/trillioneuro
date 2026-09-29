-- ════════════════════════════════════════════════════════════════════
--  TRILLIONEURO + QUADRILLIONEURO + RIPESTREAM — SUPABASE SETUP
--
--  Run this whole file in: Supabase dashboard → SQL Editor → New query → Run.
--  Idempotent: safe to re-run against the live project.
--
--  ONE PROJECT, BOTH SITES. Every Quadrillioneuro object is quad_*-prefixed
--  and lives here alongside Trillioneuro's. The earlier notes in this repo
--  called that a compromise forced by the free-tier project limit; it is
--  actually the right call for this business, and deliberately kept:
--  the two products share the same audience, so cross-sell, one keep-alive,
--  one set of credentials and one place to look are worth more than
--  isolation between two tables nobody joins. Access is gated per table by
--  column grants + RLS, not by which project a table sits in.
--
--  SECURITY MODEL (this is the part worth understanding before editing):
--    • anon has NO privilege on any table that stores an email address.
--      Not "RLS denies it" — the SELECT privilege on the `email` column is
--      not granted, so the column is unreachable even if a policy is later
--      loosened by mistake.
--    • Every write goes through a SECURITY DEFINER function with a pinned
--      search_path. Those functions validate, sanitise and rate-limit.
--    • The public views are security_invoker, so they carry no privilege of
--      their own and cannot become a leak by being edited.
--
--  Verify any time with the block at the bottom of this file.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ════════════════════════════════════════════════════════════════════
--  SHARED: RATE LIMITING
--
--  Both public RPCs were previously unbounded. On Trillioneuro that is the
--  whole asset: founder_number is `generated always as identity`, so a
--  script that inserts 5,000 junk rows permanently consumes the first
--  5,000 numbers, and the product cannot undo it without breaking the
--  permanence it sells.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Client IP as PostgREST sees it. Only the first hop of x-forwarded-for is
-- the caller; the rest are trivially spoofable. Degrades to a shared
-- bucket rather than to "unlimited" when no header is present.
create or replace function public.client_ip()
returns text language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare v_hdrs json; v_xff text;
begin
  begin
    v_hdrs := nullif(current_setting('request.headers', true), '')::json;
  exception when others then return 'unknown';
  end;
  if v_hdrs is null then return 'unknown'; end if;
  v_xff := v_hdrs ->> 'x-forwarded-for';
  if v_xff is null or length(trim(v_xff)) = 0 then return 'unknown'; end if;
  return trim(split_part(v_xff, ',', 1));
end $$;
revoke all on function public.client_ip() from public, anon, authenticated;

create or replace function public.rl_allow(p_action text, p_limit integer, p_window interval)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_bucket text; v_window timestamptz; v_hits integer; v_secs numeric;
begin
  v_secs   := greatest(extract(epoch from p_window), 1);
  v_bucket := p_action || ':' || public.client_ip();
  v_window := to_timestamp(floor(extract(epoch from now()) / v_secs) * v_secs);

  insert into public.rate_limits (bucket, window_start, hits)
  values (v_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  delete from public.rate_limits where window_start < now() - (p_window * 4);
  return v_hits <= p_limit;
end $$;
revoke all on function public.rl_allow(text,integer,interval) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
--  SHARED: INPUT SANITISATION
--
--  Both public pages render names into innerHTML, so a 30-character name is
--  enough room for a stored XSS ('<img src=x onerror=...>' fits). The pages
--  escape on output too — this is the second layer so that a future page
--  which forgets cannot be exploited.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.clean_text(p_raw text)
returns text language sql immutable
set search_path = public, pg_temp as $$
  select nullif(btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_raw, ''), '[<>]', '', 'g'),
        '[\x00-\x1F\x7F]', ' ', 'g'),
      '\s+', ' ', 'g')), '');
$$;

-- ════════════════════════════════════════════════════════════════════
--  TRILLIONEURO
-- ════════════════════════════════════════════════════════════════════
--  id             = immutable identity.
--  founder_number = permanent join order, never reused.
--  RANK IS NOT STORED. It is computed in founders_public, so a person's
--  displayed position can change without their record ever changing.
--  That separation is what lets the site promise permanence honestly while
--  leaving display position contestable later.

create table if not exists public.founders (
  id             uuid primary key default gen_random_uuid(),
  founder_number bigint generated always as identity,
  name           text not null check (char_length(name) between 1 and 30),
  email          text not null unique,
  message        text check (char_length(message) <= 80),
  country        text,
  avatar_url     text,
  avatar_status  text not null default 'none'
                 check (avatar_status in ('none','pending','approved','rejected')),
  created_at     timestamptz not null default now()
);

alter table public.founders add column if not exists ref_code    text;
alter table public.founders add column if not exists referred_by text;
update public.founders set ref_code = encode(extensions.gen_random_bytes(5), 'hex')
 where ref_code is null;
alter table public.founders alter column ref_code set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'founders_ref_code_key') then
    alter table public.founders add constraint founders_ref_code_key unique (ref_code);
  end if;
end $$;

create index if not exists founders_number_idx      on public.founders (founder_number);
create index if not exists founders_country_idx     on public.founders (country);
create index if not exists founders_referred_by_idx on public.founders (referred_by);
create index if not exists founders_created_at_idx  on public.founders (created_at);

alter table public.founders enable row level security;

drop policy if exists "anyone can reserve a place" on public.founders;
create policy "anyone can reserve a place"
  on public.founders for insert to anon with check (true);

-- The record is public by design, so rows are readable. Which COLUMNS are
-- readable is controlled by the grants below, not by this policy.
drop policy if exists "public record is readable" on public.founders;
create policy "public record is readable"
  on public.founders for select to anon using (true);

-- avatar_url / avatar_status are deliberately NOT in this view. There is no
-- moderation pipeline yet and the claim form no longer uploads avatars;
-- including them would require granting anon SELECT on avatar_url, which
-- would expose un-approved uploads the day that feature ships.
drop view if exists public.founders_public;
create view public.founders_public with (security_invoker = true) as
  select founder_number, name, message, country, created_at,
         row_number() over (order by founder_number asc) as rank
  from public.founders;

revoke all on public.founders from anon;
grant insert on public.founders to anon;
grant select (founder_number, name, message, country, created_at)
  on public.founders to anon;             -- note: `email` is never granted
revoke all on public.founders_public from anon;
grant select on public.founders_public to anon;

-- Email-only pre-registrations (hero field, captured on blur).
create table if not exists public.founder_interests (
  id         bigserial primary key,
  email      text unique not null,
  created_at timestamptz default now()
);
alter table public.founder_interests enable row level security;
-- No anon policy and no anon grant: writes go through capture_email() only.
revoke all on public.founder_interests from anon;

-- ── reserve_founder (the ONLY way a founder row is created) ──────────
create or replace function public.reserve_founder(
  p_name text, p_email text, p_message text default null,
  p_country text default null, p_ref_in text default null
) returns table(founder_number bigint, ref_code text, referral_count bigint)
language plpgsql security definer
-- search_path is pinned and it is not optional: a DEFINER function with a
-- caller-influenced search_path is the classic privilege-escalation shape.
-- Note that pinning it means pgcrypto must be schema-qualified, because it
-- installs into `extensions` on Supabase.
set search_path = public, pg_temp as $$
declare
  v_founder_number bigint; v_ref_code text; v_referrer_valid boolean := false;
  v_name text; v_email text; v_message text; v_country text;
begin
  if not public.rl_allow('reserve_founder', 10, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts from this connection' using errcode = '54000';
  end if;

  v_name    := public.clean_text(p_name);
  v_email   := lower(trim(coalesce(p_email, '')));
  v_message := left(coalesce(public.clean_text(p_message), ''), 80);
  v_country := left(coalesce(public.clean_text(p_country), ''), 60);

  if v_name is null or char_length(v_name) not between 1 and 30 then
    raise exception 'INVALID_NAME: name must be 1-30 characters' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$' or char_length(v_email) > 254 then
    raise exception 'INVALID_EMAIL: that email address is not valid' using errcode = '22023';
  end if;

  if p_ref_in is not null and length(trim(p_ref_in)) > 0 then
    select exists(select 1 from public.founders f where f.ref_code = trim(p_ref_in))
      into v_referrer_valid;
  end if;

  -- Email is lower-cased BEFORE the unique constraint sees it. The previous
  -- version inserted it raw, so "A@b.com" and "a@b.com" could both hold a
  -- place — quietly breaking the stated "one place per email" rule.
  insert into public.founders (name, email, message, country, ref_code, referred_by)
  values (v_name, v_email, nullif(v_message,''), nullif(v_country,''),
          encode(extensions.gen_random_bytes(5), 'hex'),
          case when v_referrer_valid then trim(p_ref_in) else null end)
  returning founders.founder_number, founders.ref_code into v_founder_number, v_ref_code;

  -- Referrals are ATTRIBUTION ONLY. They never change founder_number or
  -- join order — a "share to jump the queue" mechanic would directly
  -- contradict the one promise this product makes.
  return query select v_founder_number, v_ref_code,
    (select count(*) from public.founders f2 where f2.referred_by = v_ref_code);
end $$;

revoke all on function public.reserve_founder(text,text,text,text,text) from public;
grant execute on function public.reserve_founder(text,text,text,text,text) to anon;

-- Retire the pre-referral 4-arg overload. `create or replace` only replaces a
-- MATCHING signature, so adding p_ref_in left a second anon-callable entry
-- point that wrote founder rows without recording the referrer.
drop function if exists public.reserve_founder(text,text,text,text);

-- ════════════════════════════════════════════════════════════════════
--  QUADRILLIONEURO
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.quad_interests (
  id            uuid primary key default gen_random_uuid(),
  seat          text not null,          -- canonical code: 'WORLD' or ISO-2
  name          text not null check (char_length(name) between 1 and 30),
  email         text not null,
  country       text,
  max_bid_hint  text,                   -- optional, non-binding, free text
  ref_code      text not null unique,
  referred_by   text,
  created_at    timestamptz not null default now(),
  unique (seat, email)
);

create index if not exists quad_interests_seat_idx         on public.quad_interests (seat);
create index if not exists quad_interests_ref_idx          on public.quad_interests (referred_by);
-- register_interest computes queue position with
-- `count(*) where seat = $1 and created_at <= $2` on every signup; without
-- this composite index that is a full scan per registration.
create index if not exists quad_interests_seat_created_idx on public.quad_interests (seat, created_at);

alter table public.quad_interests enable row level security;
drop policy if exists "anyone can register interest" on public.quad_interests;
create policy "anyone can register interest"
  on public.quad_interests for insert to anon with check (true);
drop policy if exists "seat totals are public" on public.quad_interests;
create policy "seat totals are public"
  on public.quad_interests for select to anon using (true);

-- count(seat) not count(*): seat is NOT NULL so the value is identical, and
-- it keeps the view satisfiable by a grant on that single column rather than
-- needing table-wide SELECT.
drop view if exists public.quad_seat_counts;
create view public.quad_seat_counts with (security_invoker = true) as
  select seat, count(seat)::bigint as registered
  from public.quad_interests group by seat;

revoke all on public.quad_interests from anon;
grant select (seat) on public.quad_interests to anon;   -- seat only; not email, not name
revoke all on public.quad_seat_counts from anon;
grant select on public.quad_seat_counts to anon;

create table if not exists public.quad_prewarm (
  id bigserial primary key, email text unique not null,
  created_at timestamptz default now()
);
alter table public.quad_prewarm enable row level security;
revoke all on public.quad_prewarm from anon;   -- capture_email() only

-- Hall of Champions: written by you (service role) after a season really
-- closes, never by anon. That is what makes "never erased" trustworthy.
create table if not exists public.quad_champions (
  id uuid primary key default gen_random_uuid(),
  seat text not null, name text not null, country text,
  season int not null, winning_bid numeric,
  won_at timestamptz not null default now()
);
alter table public.quad_champions enable row level security;
drop policy if exists "anyone can read champions" on public.quad_champions;
create policy "anyone can read champions"
  on public.quad_champions for select to anon using (true);
revoke all on public.quad_champions from anon;
grant select on public.quad_champions to anon;

-- ── SEAT CANONICALISATION ────────────────────────────────────────────
--  Fixes a live, product-breaking defect. The homepage's seat cards are
--  keyed on ISO codes (data-seat-status="IE") but the page sent the
--  free-text country field as the seat, so registering for Ireland stored
--  seat='Ireland' while the card kept reading seatCounts['IE'] and showing
--  zero. Every country seat's progress bar was stuck at 0 permanently — and
--  the 1,000-registration threshold IS the product. Free text also
--  fragmented counts: Ireland / ireland / IRL / IE each became a separate
--  seat with its own threshold.
--
--  Canonicalised in the database, not the browser, so it holds regardless
--  of what any client sends.
create table if not exists public.quad_seat_map (
  alias text primary key,   -- lower-cased alias or code
  code  text not null
);
alter table public.quad_seat_map enable row level security;
revoke all on public.quad_seat_map from anon, authenticated;

insert into public.quad_seat_map (alias, code) values
  ('world','WORLD'),('global','WORLD'),('earth','WORLD'),
  ('ie','IE'),('ireland','IE'),('irl','IE'),('eire','IE'),('republic of ireland','IE'),
  ('us','US'),('usa','US'),('united states','US'),('united states of america','US'),('america','US'),
  ('gb','GB'),('uk','GB'),('united kingdom','GB'),('great britain','GB'),('britain','GB'),
  ('england','GB'),('scotland','GB'),('wales','GB'),('northern ireland','GB'),
  ('de','DE'),('germany','DE'),('deutschland','DE'),
  ('fr','FR'),('france','FR'),
  ('au','AU'),('australia','AU'),
  ('ca','CA'),('canada','CA'),
  ('nl','NL'),('netherlands','NL'),('holland','NL'),
  ('in','IN'),('india','IN'),
  ('br','BR'),('brazil','BR'),('brasil','BR'),
  ('jp','JP'),('japan','JP'),
  ('es','ES'),('spain','ES'),('espana','ES'),('españa','ES'),
  ('it','IT'),('italy','IT'),('italia','IT'),
  ('nz','NZ'),('new zealand','NZ'),
  ('za','ZA'),('south africa','ZA'),
  ('pt','PT'),('portugal','PT'),
  ('pl','PL'),('poland','PL'),('polska','PL'),
  ('se','SE'),('sweden','SE'),('sverige','SE'),
  ('no','NO'),('norway','NO'),('norge','NO'),
  ('dk','DK'),('denmark','DK'),('danmark','DK'),
  ('fi','FI'),('finland','FI'),('suomi','FI'),
  ('be','BE'),('belgium','BE'),
  ('at','AT'),('austria','AT'),('osterreich','AT'),('österreich','AT'),
  ('ch','CH'),('switzerland','CH'),('schweiz','CH'),
  ('mx','MX'),('mexico','MX'),('méxico','MX'),
  ('ar','AR'),('argentina','AR'),
  ('cl','CL'),('chile','CL'),
  ('co','CO'),('colombia','CO'),
  ('ae','AE'),('uae','AE'),('united arab emirates','AE'),
  ('sa','SA'),('saudi arabia','SA'),
  ('sg','SG'),('singapore','SG'),
  ('my','MY'),('malaysia','MY'),
  ('ph','PH'),('philippines','PH'),
  ('id','ID'),('indonesia','ID'),
  ('th','TH'),('thailand','TH'),
  ('vn','VN'),('vietnam','VN'),
  ('kr','KR'),('south korea','KR'),('korea','KR'),
  ('cn','CN'),('china','CN'),
  ('hk','HK'),('hong kong','HK'),
  ('tw','TW'),('taiwan','TW'),
  ('ng','NG'),('nigeria','NG'),
  ('ke','KE'),('kenya','KE'),
  ('eg','EG'),('egypt','EG'),
  ('ma','MA'),('morocco','MA'),
  ('gh','GH'),('ghana','GH'),
  ('tr','TR'),('turkey','TR'),('türkiye','TR'),
  ('gr','GR'),('greece','GR'),
  ('cz','CZ'),('czechia','CZ'),('czech republic','CZ'),
  ('ro','RO'),('romania','RO'),
  ('hu','HU'),('hungary','HU'),
  ('ua','UA'),('ukraine','UA'),
  ('il','IL'),('israel','IL'),
  ('pk','PK'),('pakistan','PK'),
  ('bd','BD'),('bangladesh','BD'),
  ('lk','LK'),('sri lanka','LK'),
  ('pe','PE'),('peru','PE'),
  ('uy','UY'),('uruguay','UY'),
  ('is','IS'),('iceland','IS'),
  ('lu','LU'),('luxembourg','LU'),
  ('mt','MT'),('malta','MT'),
  ('hr','HR'),('croatia','HR'),
  ('rs','RS'),('serbia','RS'),
  ('bg','BG'),('bulgaria','BG'),
  ('sk','SK'),('slovakia','SK'),
  ('si','SI'),('slovenia','SI'),
  ('lt','LT'),('lithuania','LT'),
  ('lv','LV'),('latvia','LV'),
  ('ee','EE'),('estonia','EE')
on conflict (alias) do update set code = excluded.code;

create or replace function public.canon_seat(p_raw text)
returns text language plpgsql immutable
set search_path = public, pg_temp as $$
declare v_key text; v_code text;
begin
  if p_raw is null or length(trim(p_raw)) = 0 then return 'UNKNOWN'; end if;
  v_key := lower(regexp_replace(trim(p_raw), '\s+', ' ', 'g'));
  select m.code into v_code from public.quad_seat_map m where m.alias = v_key;
  if v_code is not null then return v_code; end if;
  -- Unknown country: normalise casing/spacing so obvious variants of the
  -- same answer still land on one seat, and cap the length so `seat` can
  -- never be used as a free-form text store.
  return left(upper(v_key), 40);
end $$;

-- ── register_interest ────────────────────────────────────────────────
-- Returns seat_code so the page can key its cache and its confirmation
-- label on the seat the database actually stored, rather than on the raw
-- string the visitor typed.
drop function if exists public.register_interest(text,text,text,text,text);
drop function if exists public.register_interest(text,text,text,text,text,text);

create function public.register_interest(
  p_seat text, p_name text, p_email text, p_country text, p_ref_in text,
  p_bid_hint text default null
) returns table(queue_position bigint, ref_code text, referral_count bigint,
                seat_total bigint, seat_code text)
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_ref_code text; v_referrer_valid boolean := false; v_created_at timestamptz;
  v_seat text; v_name text; v_email text; v_country text; v_bid_hint text;
begin
  if not public.rl_allow('register_interest', 15, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts from this connection' using errcode = '54000';
  end if;

  v_seat     := public.canon_seat(p_seat);
  v_name     := public.clean_text(p_name);
  v_email    := lower(trim(coalesce(p_email, '')));
  v_country  := left(coalesce(public.clean_text(p_country), ''), 60);
  v_bid_hint := left(coalesce(public.clean_text(p_bid_hint), ''), 40);

  if v_name is null or char_length(v_name) not between 1 and 30 then
    raise exception 'INVALID_NAME: name must be 1-30 characters' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$' or char_length(v_email) > 254 then
    raise exception 'INVALID_EMAIL: that email address is not valid' using errcode = '22023';
  end if;

  if p_ref_in is not null and length(trim(p_ref_in)) > 0 then
    -- Aliased: ref_code is also an OUT parameter of this function, and the
    -- unaliased form fails with "column reference ref_code is ambiguous".
    select exists(select 1 from public.quad_interests qi where qi.ref_code = trim(p_ref_in))
      into v_referrer_valid;
  end if;

  insert into public.quad_interests as qt
    (seat, name, email, country, max_bid_hint, ref_code, referred_by)
  values (v_seat, v_name, v_email, nullif(v_country,''), nullif(v_bid_hint,''),
          encode(extensions.gen_random_bytes(5), 'hex'),
          case when v_referrer_valid then trim(p_ref_in) else null end)
  on conflict (seat, email) do update
    set name = excluded.name,
        max_bid_hint = coalesce(excluded.max_bid_hint, qt.max_bid_hint)
  returning qt.ref_code, qt.created_at into v_ref_code, v_created_at;

  return query select
    (select count(*) from public.quad_interests q2
       where q2.seat = v_seat and q2.created_at <= v_created_at),
    v_ref_code,
    (select count(*) from public.quad_interests q4 where q4.referred_by = v_ref_code),
    (select count(*) from public.quad_interests q3 where q3.seat = v_seat),
    v_seat;
end $$;

revoke all on function public.register_interest(text,text,text,text,text,text) from public;
grant execute on function public.register_interest(text,text,text,text,text,text) to anon;

-- ════════════════════════════════════════════════════════════════════
--  SHARED: HERO EMAIL CAPTURE
--
--  Both hero fields used to INSERT directly as anon, on blur, with no
--  validation beyond "contains @" and no rate limit. An unauthenticated,
--  unthrottled write path into a table of email addresses is the cheapest
--  abuse target either site had.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.capture_email(p_email text, p_site text default 'trillion')
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_email text;
begin
  -- Silent on refusal: this is a background convenience with no UI to show
  -- an error in, and telling a scraper it hit a limit tells it one exists.
  if not public.rl_allow('capture_email', 20, interval '1 hour') then return; end if;

  v_email := lower(trim(coalesce(p_email, '')));
  if v_email !~ '^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$' or char_length(v_email) > 254 then return; end if;

  if p_site = 'quad' then
    insert into public.quad_prewarm (email) values (v_email) on conflict (email) do nothing;
  else
    insert into public.founder_interests (email) values (v_email) on conflict (email) do nothing;
  end if;
end $$;

revoke all on function public.capture_email(text,text) from public;
grant execute on function public.capture_email(text,text) to anon;

-- ════════════════════════════════════════════════════════════════════
--  RIPESTREAM
--
--  Interest list only. rs_*-prefixed like quad_*. Same model as the other
--  two sites: anon holds no privilege on the table, the single write path
--  is rs_register_interest(), which validates, sanitises and rate-limits.
--  A repeat email is a silent no-op (the original row, and its first
--  name, are kept) and returns the same response, so the endpoint cannot
--  be used to test whether someone is on the list.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.rs_interests (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (char_length(email) <= 254),
  first_name  text check (first_name is null or char_length(first_name) between 1 and 40),
  source      text,                    -- which form: hero / join / final
  created_at  timestamptz not null default now()
);
alter table public.rs_interests enable row level security;
revoke all on public.rs_interests from anon, authenticated;

create or replace function public.rs_register_interest(
  p_email text, p_first_name text default null, p_source text default null
) returns boolean
language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_email text; v_name text; v_source text;
begin
  if not public.rl_allow('rs_register_interest', 10, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts from this connection' using errcode = '54000';
  end if;

  v_email  := lower(trim(coalesce(p_email, '')));
  v_name   := left(public.clean_text(p_first_name), 40);
  v_source := left(coalesce(public.clean_text(p_source), ''), 20);

  if v_email !~ '^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$' or char_length(v_email) > 254 then
    raise exception 'INVALID_EMAIL: that email address is not valid' using errcode = '22023';
  end if;

  insert into public.rs_interests (email, first_name, source)
  values (v_email, v_name, nullif(v_source, ''))
  on conflict (email) do nothing;
  return true;
end $$;

revoke all on function public.rs_register_interest(text,text,text) from public;
grant execute on function public.rs_register_interest(text,text,text) to anon;

-- ── RipeStream emails ───────────────────────────────────────────────
--  Every new row fires the rs-notify Edge Function (supabase/functions/
--  rs-notify) through pg_net. It sends the confirmation + owner alert over
--  Google Workspace SMTP and stamps notified_at. Duplicates never insert, so never email.
--  If the SMTP password isn't in Vault yet, rows stay notified_at = null; once it
--  is, send the backlog with:
--    select public.rs_notify_backlog();
create extension if not exists pg_net with schema extensions;
alter table public.rs_interests add column if not exists notified_at timestamptz;

create or replace function public.rs_notify_row()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  perform net.http_post(
    url     := 'https://kxzywyflylkcqoidiqmo.supabase.co/functions/v1/rs-notify',
    body    := jsonb_build_object('id', new.id),
    headers := '{"Content-Type":"application/json"}'::jsonb);
  return new;
exception when others then
  return new;          -- an email problem must never block a registration
end $$;
revoke all on function public.rs_notify_row() from public, anon, authenticated;

drop trigger if exists rs_interests_notify on public.rs_interests;
create trigger rs_interests_notify after insert on public.rs_interests
  for each row execute function public.rs_notify_row();

create or replace function public.rs_notify_backlog()
returns integer language plpgsql security definer
set search_path = public, pg_temp as $$
declare n integer := 0; r record;
begin
  for r in select id from public.rs_interests where notified_at is null order by created_at loop
    perform net.http_post(
      url     := 'https://kxzywyflylkcqoidiqmo.supabase.co/functions/v1/rs-notify',
      body    := jsonb_build_object('id', r.id),
      headers := '{"Content-Type":"application/json"}'::jsonb);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.rs_notify_backlog() from public, anon, authenticated;

-- Mail credentials for rs-notify live in Supabase Vault, never in the repo.
-- Only the service role (the Edge Function) can read them:
--   select vault.create_secret('<google app password>', 'rs_smtp_pass');
create or replace function public.rs_mail_config()
returns table(smtp_user text, smtp_pass text, admin_email text, mail_from text)
language sql stable security definer
set search_path = public, pg_temp as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'rs_smtp_user'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'rs_smtp_pass'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'rs_admin_email'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'rs_from');
$$;
revoke all on function public.rs_mail_config() from public, anon, authenticated;
grant execute on function public.rs_mail_config() to service_role;

-- ════════════════════════════════════════════════════════════════════
--  VERIFY  — run this any time; every value must read as stated.
-- ════════════════════════════════════════════════════════════════════
select
  case when has_column_privilege('anon','public.founders','email','SELECT')
       then 'FAIL: founder emails readable' else 'ok: founder emails blocked' end       as check_1,
  case when has_column_privilege('anon','public.quad_interests','email','SELECT')
       then 'FAIL: quad emails readable'    else 'ok: quad emails blocked' end          as check_2,
  case when has_column_privilege('anon','public.founders','name','SELECT')
       then 'ok: public record readable'    else 'FAIL: record unreadable' end          as check_3,
  case when has_table_privilege('anon','public.founders','TRUNCATE')
       then 'FAIL: anon can TRUNCATE'       else 'ok: TRUNCATE blocked' end             as check_4,
  case when public.canon_seat('Ireland') = 'IE' and public.canon_seat('ireland') = 'IE'
       then 'ok: seats canonicalise'        else 'FAIL: seat mapping broken' end        as check_5,
  case when public.clean_text('<b>x</b>') = 'bx/b'
       then 'ok: markup stripped'           else 'FAIL: sanitiser changed' end          as check_6,
  case when has_table_privilege('anon','public.rs_interests','SELECT')
         or has_table_privilege('anon','public.rs_interests','INSERT')
       then 'FAIL: rs_interests reachable'  else 'ok: rs_interests RPC-only' end        as check_7;

-- ─────────────────────────────────────────────────────────────────────
--  EXPORT THE LISTS
--    select name, email, country, created_at from founders order by founder_number;
--    select seat, name, email, max_bid_hint, created_at from quad_interests order by created_at;
--    select email, first_name, source, created_at from rs_interests order by created_at;
--
--  STILL TO BUILD (deliberately not built yet):
--   • Transactional email. Both sites promise "we'll email you"; nothing
--     sends. No Edge Function, no mail provider. Build this BEFORE the
--     10,000 threshold, not by deleting the promise.
--   • €1/year badge renewal: a `payments` table (founder_id, year, paid_at)
--     and badge_active derived from whether the current year is paid. Never
--     alter or remove the founders row for a lapsed payment.
--   • Real bidding: a `quad_bids` table behind Stripe Checkout (never raw
--     card fields), then a season-close job that writes one quad_champions
--     row. Never delete from quad_champions.
--   • Avatars: upload to Storage, avatar_status='pending', approve before
--     it is ever public, then add the columns back to founders_public.
-- ─────────────────────────────────────────────────────────────────────
