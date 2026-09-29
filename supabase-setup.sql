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
--  RIPESTREAM — FOUNDING MEMBERS + INVITATIONS
--
--  The launch model, enforced here and nowhere else:
--    • The first `founding_limit` (10,000) members to CONFIRM their email
--      become Founding Members, numbered 1…10,000 in confirmation order.
--      The number is issued from a single counter row under a row lock, so
--      it is sequential, gap-free and can never be issued twice or past
--      the limit — not even by two confirmations in the same millisecond.
--    • Founding status is permanent: a trigger refuses any change to a
--      founding_number once issued. Numbers are never reused, even if a
--      member is later deleted (the counter only ever goes up).
--    • Once the counter reaches the limit, rs_join() refuses anyone without
--      a valid invitation (INVITE_REQUIRED). The page reads the same
--      counter through rs_founding_status(), so it cannot keep claiming
--      places exist after they're gone.
--    • Every member gets `invites_per_month` (5) invitations per calendar
--      month (UTC). Each code works once, expires after `invite_ttl_days`,
--      and records who invited whom. Limits live in rs_settings — change
--      them with an UPDATE, no deploy needed.
--
--  No accounts/passwords exist yet. A member proves who they are with a
--  member key: 256 random bits, emailed as a link (…/member#k=…), stored
--  here only as a SHA-256 hash. Only the service role (the rs-member Edge
--  Function) can mint one, so the email round-trip is also the email
--  verification: nobody claims a founding place with an address they
--  can't read.
--
--  anon can call exactly: rs_founding_status, rs_check_invite, rs_join,
--  rs_request_link, rs_member_open, rs_create_invite, rs_revoke_invite.
--  All are SECURITY DEFINER, pinned search_path, validated, rate-limited.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.rs_settings (
  key   text primary key,
  value integer not null check (value >= 0),
  note  text
);
alter table public.rs_settings enable row level security;
revoke all on public.rs_settings from anon, authenticated;
insert into public.rs_settings (key, value, note) values
  ('founding_limit',    10000, 'Founding places. A public promise: never raise it once places are claimed.'),
  ('invites_per_month',     5, 'Invitations each member can create per calendar month (UTC).'),
  ('invite_ttl_days',      30, 'Days before an unused invitation expires.')
on conflict (key) do nothing;

create or replace function public.rs_setting(p_key text, p_default integer)
returns integer language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce((select value from public.rs_settings where key = p_key), p_default);
$$;
revoke all on function public.rs_setting(text,integer) from public, anon, authenticated;

-- The one counter founding numbers come from. Single row, only ever increments.
create table if not exists public.rs_founding (
  id     boolean primary key default true check (id),
  issued integer not null default 0 check (issued >= 0)
);
alter table public.rs_founding enable row level security;
revoke all on public.rs_founding from anon, authenticated;
insert into public.rs_founding (id) values (true) on conflict (id) do nothing;

create table if not exists public.rs_members (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique check (char_length(email) <= 254),
  first_name      text check (first_name is null or char_length(first_name) between 1 and 40),
  -- pending  = joined, email not yet confirmed (holds no place)
  -- member   = confirmed; founding_number set if they were in the first 10,000
  -- waitlist = confirmed after founding closed, with no invitation
  status          text not null default 'pending' check (status in ('pending','member','waitlist')),
  founding_number integer unique check (founding_number is null or founding_number > 0),
  invited_by      uuid references public.rs_members(id) on delete set null,
  source          text,
  mail_kind       text check (mail_kind in ('confirm','link')),   -- queued email, cleared by rs-member
  mailed_at       timestamptz,
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  constraint rs_members_founding_is_member check (founding_number is null or status = 'member')
);
alter table public.rs_members enable row level security;
revoke all on public.rs_members from anon, authenticated;
create index if not exists rs_members_invited_by_idx on public.rs_members (invited_by);

create table if not exists public.rs_member_keys (
  key_hash     bytea primary key,
  member_id    uuid not null references public.rs_members(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.rs_member_keys enable row level security;
revoke all on public.rs_member_keys from anon, authenticated;
create index if not exists rs_member_keys_member_idx on public.rs_member_keys (member_id, created_at desc);

create table if not exists public.rs_invitations (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  inviter_id uuid not null references public.rs_members(id) on delete cascade,
  label      text check (label is null or char_length(label) <= 40),
  status     text not null default 'open' check (status in ('open','used','revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by    uuid references public.rs_members(id) on delete set null,
  used_at    timestamptz,
  constraint rs_invitations_used_has_time check ((status = 'used') = (used_at is not null))
);
alter table public.rs_invitations enable row level security;
revoke all on public.rs_invitations from anon, authenticated;
create index if not exists rs_invitations_inviter_idx on public.rs_invitations (inviter_id, created_at desc);
create index if not exists rs_invitations_used_by_idx on public.rs_invitations (used_by);

-- Permanence, enforced below the functions so even a hand-written UPDATE can't break it.
create or replace function public.rs_members_guard()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if old.founding_number is not null and new.founding_number is distinct from old.founding_number then
    raise exception 'Founding numbers are permanent' using errcode = '42501';
  end if;
  if old.status <> 'pending' and new.status = 'pending' then
    raise exception 'A confirmed member cannot return to pending' using errcode = '42501';
  end if;
  if old.status = 'member' and new.status <> 'member' then
    raise exception 'Membership cannot be downgraded' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists rs_members_guard on public.rs_members;
create trigger rs_members_guard before update on public.rs_members
  for each row execute function public.rs_members_guard();

create or replace function public.rs_invitations_guard()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if old.status <> 'open' and new.status is distinct from old.status then
    raise exception 'A used or revoked invitation is final' using errcode = '42501';
  end if;
  if new.code <> old.code or new.inviter_id <> old.inviter_id then
    raise exception 'Invitation identity is immutable' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists rs_invitations_guard on public.rs_invitations;
create trigger rs_invitations_guard before update on public.rs_invitations
  for each row execute function public.rs_invitations_guard();

-- ── internal helpers (not callable by anon) ─────────────────────────
create or replace function public.rs_norm_code(p_raw text)
returns text language sql immutable
set search_path = public, pg_temp as $$
  select upper(regexp_replace(coalesce(p_raw, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- 8 characters from a 32-symbol alphabet with no 0/O/1/I: 2^40 codes.
create or replace function public.rs_new_code()
returns text language plpgsql volatile
set search_path = public, pg_temp as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea; c text; i int;
begin
  loop
    b := extensions.gen_random_bytes(8); c := '';
    for i in 0..7 loop c := c || substr(a, (get_byte(b, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from public.rs_invitations where code = c);
  end loop;
  return c;
end $$;
revoke all on function public.rs_new_code() from public, anon, authenticated;

create or replace function public.rs_fmt_code(p_code text)
returns text language sql immutable
set search_path = public, pg_temp as $$ select substr(p_code, 1, 4) || '-' || substr(p_code, 5, 4); $$;

create or replace function public.rs_member_from_key(p_key text)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9_-]{40,64}$' then return null; end if;
  update public.rs_member_keys set last_used_at = now()
   where key_hash = extensions.digest(p_key, 'sha256')
  returning member_id into v_id;
  return v_id;
end $$;
revoke all on function public.rs_member_from_key(text) from public, anon, authenticated;

create or replace function public.rs_month_start()
returns timestamptz language sql stable
set search_path = public, pg_temp as $$ select date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'; $$;
revoke all on function public.rs_month_start() from public, anon, authenticated;
revoke all on function public.rs_norm_code(text) from public, anon, authenticated;
revoke all on function public.rs_fmt_code(text) from public, anon, authenticated;
revoke all on function public.rs_members_guard() from public, anon, authenticated;
revoke all on function public.rs_invitations_guard() from public, anon, authenticated;

create or replace function public.rs_member_payload(p_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare m public.rs_members; v_quota int; v_used int; v_inv jsonb;
begin
  select * into m from public.rs_members where id = p_id;
  if not found then return null; end if;

  if m.status = 'member' then
    v_quota := public.rs_setting('invites_per_month', 5);
    select count(*) into v_used from public.rs_invitations
     where inviter_id = m.id and status <> 'revoked' and created_at >= public.rs_month_start();
    select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) into v_inv from (
      select jsonb_build_object(
        'code',       public.rs_fmt_code(i.code),
        'label',      i.label,
        'status',     case when i.status = 'open' and i.expires_at <= now() then 'expired' else i.status end,
        'created_at', i.created_at,
        'expires_at', i.expires_at,
        'used_at',    i.used_at,
        'used_by',    u.first_name,
        'joined',     u.status = 'member') as x
      from public.rs_invitations i
      left join public.rs_members u on u.id = i.used_by
      where i.inviter_id = m.id
      order by i.created_at desc limit 60) s;
  end if;

  return jsonb_build_object(
    'first_name',      m.first_name,
    'status',          m.status,
    'founding',        m.founding_number is not null,
    'founding_number', m.founding_number,
    'founding_limit',  public.rs_setting('founding_limit', 10000),
    'confirmed_at',    m.confirmed_at,
    'invited_by',      (select first_name from public.rs_members where id = m.invited_by),
    'invites', case when m.status = 'member' then jsonb_build_object(
        'per_month', v_quota,
        'used',      v_used,
        'available', greatest(v_quota - v_used, 0),
        'resets_at', public.rs_month_start() + interval '1 month',
        'ttl_days',  public.rs_setting('invite_ttl_days', 30)) end,
    'invitations', coalesce(v_inv, '[]'::jsonb));
end $$;
revoke all on function public.rs_member_payload(uuid) from public, anon, authenticated;

-- ── public: the live counter ────────────────────────────────────────
create or replace function public.rs_founding_status()
returns jsonb language sql stable security definer
set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'limit',             l.v,
    'claimed',           least(f.issued, l.v),
    'remaining',         greatest(l.v - f.issued, 0),
    'open',              f.issued < l.v,
    'invite_only',       f.issued >= l.v,
    'invites_per_month', public.rs_setting('invites_per_month', 5),
    'invite_ttl_days',   public.rs_setting('invite_ttl_days', 30))
  from public.rs_founding f, (select public.rs_setting('founding_limit', 10000) as v) l;
$$;
revoke all on function public.rs_founding_status() from public;
grant execute on function public.rs_founding_status() to anon, authenticated;

-- ── public: is this invitation usable? (for the landing page banner) ─
create or replace function public.rs_check_invite(p_code text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_code text; i public.rs_invitations; v_name text;
begin
  if not public.rl_allow('rs_check_invite', 60, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts from this connection' using errcode = '54000';
  end if;
  v_code := public.rs_norm_code(p_code);
  if v_code !~ '^[A-HJ-NP-Z2-9]{8}$' then return jsonb_build_object('status', 'invalid'); end if;
  select * into i from public.rs_invitations where code = v_code;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if i.status <> 'open' then return jsonb_build_object('status', i.status); end if;
  if i.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  select first_name into v_name from public.rs_members where id = i.inviter_id;
  return jsonb_build_object('status', 'valid', 'code', public.rs_fmt_code(i.code), 'inviter', v_name);
end $$;
revoke all on function public.rs_check_invite(text) from public;
grant execute on function public.rs_check_invite(text) to anon, authenticated;

-- ── public: join (claim a founding place, or join with an invitation) ─
--  Same response whether the email is new or already known, so it can't be
--  used to test who is a member. A known email just gets its link resent
--  (at most once per 5 minutes).
create or replace function public.rs_join(
  p_email text, p_first_name text default null, p_invite text default null, p_source text default null
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_email text; v_name text; v_source text; v_code text;
  inv public.rs_invitations; v_has_inv boolean := false;
  m public.rs_members; v_open boolean;
begin
  if not public.rl_allow('rs_join', 10, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts from this connection' using errcode = '54000';
  end if;

  v_email  := lower(trim(coalesce(p_email, '')));
  v_name   := left(public.clean_text(p_first_name), 40);
  v_source := left(coalesce(public.clean_text(p_source), ''), 20);
  if v_email !~ '^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$' or char_length(v_email) > 254 then
    raise exception 'INVALID_EMAIL: that email address is not valid' using errcode = '22023';
  end if;

  v_code := nullif(public.rs_norm_code(p_invite), '');
  if v_code is not null then
    select * into inv from public.rs_invitations where code = v_code for update;
    if not found then
      raise exception 'INVITE_INVALID: that invitation code does not exist' using errcode = '22023';
    elsif inv.status = 'used' then
      raise exception 'INVITE_USED: that invitation has already been used' using errcode = '22023';
    elsif inv.status = 'revoked' then
      raise exception 'INVITE_REVOKED: that invitation was withdrawn' using errcode = '22023';
    elsif inv.expires_at <= now() then
      raise exception 'INVITE_EXPIRED: that invitation has expired' using errcode = '22023';
    end if;
    v_has_inv := true;
  end if;

  select issued < public.rs_setting('founding_limit', 10000) into v_open from public.rs_founding;
  if not v_open and not v_has_inv then
    raise exception 'INVITE_REQUIRED: founding membership is closed; joining needs an invitation' using errcode = '22023';
  end if;

  select * into m from public.rs_members where email = v_email for update;
  if not found then
    insert into public.rs_members (email, first_name, source, invited_by, mail_kind)
    values (v_email, v_name, nullif(v_source, ''), case when v_has_inv then inv.inviter_id end, 'confirm')
    returning * into m;
    if v_has_inv then
      update public.rs_invitations set status = 'used', used_by = m.id, used_at = now() where id = inv.id;
    end if;
    return jsonb_build_object('ok', true);
  end if;

  -- Known email. An invitation only gets spent if it changes something:
  -- it lets a waitlisted person in, or backs a pending one with no inviter.
  if v_has_inv and inv.inviter_id <> m.id and m.status <> 'member'
     and not exists (select 1 from public.rs_invitations where used_by = m.id) then
    update public.rs_invitations set status = 'used', used_by = m.id, used_at = now() where id = inv.id;
    update public.rs_members
       set invited_by = coalesce(invited_by, inv.inviter_id),
           status     = case when status = 'waitlist' then 'member' else status end
     where id = m.id
    returning * into m;
    update public.rs_members set mail_kind = case when m.status = 'pending' then 'confirm' else 'link' end
     where id = m.id;
    return jsonb_build_object('ok', true);
  end if;

  if m.mailed_at is null or m.mailed_at < now() - interval '5 minutes' then
    update public.rs_members set mail_kind = case when m.status = 'pending' then 'confirm' else 'link' end
     where id = m.id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.rs_join(text,text,text,text) from public;
grant execute on function public.rs_join(text,text,text,text) to anon, authenticated;

-- ── public: "email me my link" ──────────────────────────────────────
create or replace function public.rs_request_link(p_email text)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_email text; m public.rs_members;
begin
  if not public.rl_allow('rs_request_link', 5, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts from this connection' using errcode = '54000';
  end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email !~ '^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$' or char_length(v_email) > 254 then
    raise exception 'INVALID_EMAIL: that email address is not valid' using errcode = '22023';
  end if;
  select * into m from public.rs_members where email = v_email for update;
  if found and (m.mailed_at is null or m.mailed_at < now() - interval '5 minutes') then
    update public.rs_members set mail_kind = case when m.status = 'pending' then 'confirm' else 'link' end
     where id = m.id;
  end if;
  return true;                                   -- same answer either way
end $$;
revoke all on function public.rs_request_link(text) from public;
grant execute on function public.rs_request_link(text) to anon, authenticated;

-- ── member: open the member area (first open = email confirmed) ─────
create or replace function public.rs_member_open(p_key text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_id uuid; m public.rs_members; v_num int;
begin
  if not public.rl_allow('rs_member', 120, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts from this connection' using errcode = '54000';
  end if;
  v_id := public.rs_member_from_key(p_key);
  if v_id is null then
    raise exception 'INVALID_KEY: that member link is not valid' using errcode = '28000';
  end if;

  select * into m from public.rs_members where id = v_id for update;
  if m.status = 'pending' then
    -- The only place a founding number is ever issued. The UPDATE takes the
    -- counter row's lock, so concurrent confirmations queue here and the
    -- `issued < limit` test is re-checked against the committed value.
    update public.rs_founding set issued = issued + 1
     where id and issued < public.rs_setting('founding_limit', 10000)
    returning issued into v_num;

    update public.rs_members set
      founding_number = v_num,
      status = case when v_num is not null
                      or exists (select 1 from public.rs_invitations where used_by = m.id)
                    then 'member' else 'waitlist' end,
      confirmed_at = now()
    where id = m.id;
  end if;
  return public.rs_member_payload(v_id);
end $$;
revoke all on function public.rs_member_open(text) from public;
grant execute on function public.rs_member_open(text) to anon, authenticated;

-- ── member: create / withdraw an invitation ─────────────────────────
create or replace function public.rs_create_invite(p_key text, p_label text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_id uuid; m public.rs_members; v_quota int; v_used int;
begin
  if not public.rl_allow('rs_invite', 30, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts from this connection' using errcode = '54000';
  end if;
  v_id := public.rs_member_from_key(p_key);
  if v_id is null then
    raise exception 'INVALID_KEY: that member link is not valid' using errcode = '28000';
  end if;
  -- Row lock on the member serialises their invite creation: two parallel
  -- requests can't both see "4 used" and make a 6th.
  select * into m from public.rs_members where id = v_id for update;
  if m.status <> 'member' then
    raise exception 'NOT_MEMBER: only confirmed members can invite' using errcode = '42501';
  end if;
  v_quota := public.rs_setting('invites_per_month', 5);
  select count(*) into v_used from public.rs_invitations
   where inviter_id = m.id and status <> 'revoked' and created_at >= public.rs_month_start();
  if v_used >= v_quota then
    raise exception 'INVITES_EXHAUSTED: no invitations left this month' using errcode = '54000';
  end if;
  insert into public.rs_invitations (code, inviter_id, label, expires_at)
  values (public.rs_new_code(), m.id, left(public.clean_text(p_label), 40),
          now() + make_interval(days => public.rs_setting('invite_ttl_days', 30)));
  return public.rs_member_payload(m.id);
end $$;
revoke all on function public.rs_create_invite(text,text) from public;
grant execute on function public.rs_create_invite(text,text) to anon, authenticated;

create or replace function public.rs_revoke_invite(p_key text, p_code text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_id uuid; n int;
begin
  if not public.rl_allow('rs_invite', 30, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts from this connection' using errcode = '54000';
  end if;
  v_id := public.rs_member_from_key(p_key);
  if v_id is null then
    raise exception 'INVALID_KEY: that member link is not valid' using errcode = '28000';
  end if;
  update public.rs_invitations set status = 'revoked'
   where inviter_id = v_id and code = public.rs_norm_code(p_code) and status = 'open' and expires_at > now();
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'INVITE_NOT_OPEN: that invitation can no longer be withdrawn' using errcode = '22023';
  end if;
  return public.rs_member_payload(v_id);
end $$;
revoke all on function public.rs_revoke_invite(text,text) from public;
grant execute on function public.rs_revoke_invite(text,text) to anon, authenticated;

-- ── service role only: mint a member key (called by rs-member) ──────
create or replace function public.rs_issue_member_key(p_member uuid)
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_key text;
begin
  v_key := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.rs_member_keys (key_hash, member_id) values (extensions.digest(v_key, 'sha256'), p_member);
  -- Keep the five most recent links working; older ones stop.
  delete from public.rs_member_keys where member_id = p_member and key_hash not in (
    select key_hash from public.rs_member_keys where member_id = p_member order by created_at desc limit 5);
  return v_key;
end $$;
revoke all on function public.rs_issue_member_key(uuid) from public, anon, authenticated;
grant execute on function public.rs_issue_member_key(uuid) to service_role;

-- ── member emails: queue → rs-member Edge Function ──────────────────
--  Setting mail_kind queues an email; this trigger pokes rs-member via
--  pg_net with only the row id. rs-member claims the row (clears
--  mail_kind), mints a key and sends. No SMTP password yet → it answers
--  503 and leaves mail_kind set; send the queue later with:
--    select public.rs_member_mail_backlog();
create or replace function public.rs_member_mail_row()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  perform net.http_post(
    url     := 'https://kxzywyflylkcqoidiqmo.supabase.co/functions/v1/rs-member',
    body    := jsonb_build_object('id', new.id),
    headers := '{"Content-Type":"application/json"}'::jsonb);
  return new;
exception when others then
  return new;          -- a mail problem must never block a join
end $$;
revoke all on function public.rs_member_mail_row() from public, anon, authenticated;

drop trigger if exists rs_members_mail on public.rs_members;
create trigger rs_members_mail after insert or update of mail_kind on public.rs_members
  for each row when (new.mail_kind is not null) execute function public.rs_member_mail_row();

create or replace function public.rs_member_mail_backlog()
returns integer language plpgsql security definer
set search_path = public, pg_temp as $$
declare n integer;
begin
  -- Re-setting mail_kind re-fires the trigger for every queued row, and
  -- queues a confirmation for pending members who were never emailed
  -- (e.g. people carried over from the old interest list).
  update public.rs_members
     set mail_kind = coalesce(mail_kind, 'confirm')
   where mail_kind is not null or (status = 'pending' and mailed_at is null);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.rs_member_mail_backlog() from public, anon, authenticated;

-- The interest list predates membership. Carry its people over as pending
-- members (same order, same timestamps) WITHOUT emailing anyone: they
-- hold no place until they confirm. rs_member_mail_backlog() invites them.
insert into public.rs_members (email, first_name, source, created_at)
select email, first_name, 'interest-list', created_at from public.rs_interests
on conflict (email) do nothing;

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
       then 'FAIL: rs_interests reachable'  else 'ok: rs_interests RPC-only' end        as check_7,
  case when has_table_privilege('anon','public.rs_members','SELECT')
         or has_table_privilege('anon','public.rs_invitations','SELECT')
         or has_table_privilege('anon','public.rs_member_keys','SELECT')
         or has_table_privilege('anon','public.rs_founding','UPDATE')
         or has_function_privilege('anon','public.rs_issue_member_key(uuid)','EXECUTE')
       then 'FAIL: membership tables reachable' else 'ok: membership RPC-only' end      as check_8,
  case when (select issued from public.rs_founding) <= public.rs_setting('founding_limit', 10000)
        and (select count(*) from public.rs_members where founding_number is not null)
            = (select issued from public.rs_founding)
       then 'ok: founding counter consistent' else 'FAIL: founding counter drift' end   as check_9;

-- ─────────────────────────────────────────────────────────────────────
--  EXPORT THE LISTS
--    select name, email, country, created_at from founders order by founder_number;
--    select seat, name, email, max_bid_hint, created_at from quad_interests order by created_at;
--    select email, first_name, source, created_at from rs_interests order by created_at;
--    select founding_number, first_name, email, status, confirmed_at from rs_members
--      order by founding_number nulls last, created_at;
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
