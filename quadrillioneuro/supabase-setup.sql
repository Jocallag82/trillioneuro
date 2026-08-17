-- ════════════════════════════════════════════════════════════════════
--  QUADRILLIONEURO — SUPABASE SETUP
--  Run this whole file in: Supabase dashboard → SQL Editor → New query → Run
--  STATUS: applied and smoke-tested against a live project. Three defects
--  were found by running it rather than reading it, all fixed below:
--    1. register_interest was SECURITY DEFINER with no search_path pinned.
--    2. Pinning it then broke gen_random_bytes, which lives in the
--       `extensions` schema on Supabase, not `public`. Now fully qualified.
--    3. `ref_code` is both an OUT parameter and a column, so the referral
--       lookup failed with "column reference is ambiguous". That path had
--       never been exercised. Every table reference is aliased now.
-- ════════════════════════════════════════════════════════════════════

-- ── INTEREST / QUEUE TABLE ──────────────────────────────────────────
-- One row per (seat, email). "seat" is 'WORLD' or a free-text country
-- name/code — any country can have a seat, we don't hardcode a list.
create table if not exists public.quad_interests (
  id            uuid primary key default gen_random_uuid(),
  seat          text not null,
  name          text not null check (char_length(name) between 1 and 30),
  email         text not null,
  country       text,
  max_bid_hint  text,                     -- optional, non-binding, free text ("€500" etc.)
  ref_code      text not null unique,     -- this registrant's own shareable code
  referred_by   text,                     -- another registrant's ref_code, nullable
  created_at    timestamptz not null default now(),
  unique (seat, email)
);

create index if not exists quad_interests_seat_idx on public.quad_interests (seat);
create index if not exists quad_interests_ref_idx  on public.quad_interests (referred_by);

alter table public.quad_interests enable row level security;

create policy "anyone can register interest"
  on public.quad_interests for insert
  to anon
  with check (true);

-- ── PUBLIC SEAT COUNTS (no emails, no names) ────────────────────────
create or replace view public.quad_seat_counts as
  select seat, count(*) as registered
  from public.quad_interests
  group by seat;

grant select on public.quad_seat_counts to anon;

-- ── PRE-WARM TABLE (hero email capture, before the modal is opened) ──
create table if not exists public.quad_prewarm (
  id         bigserial primary key,
  email      text unique not null,
  created_at timestamptz default now()
);
alter table public.quad_prewarm enable row level security;
create policy "anon_insert_prewarm" on public.quad_prewarm for insert to anon with check (true);

-- ── HALL OF CHAMPIONS (empty until the first bidding season closes) ─
-- Deliberately separate from quad_interests: a champion row is only
-- ever inserted by you (service role), after a real bidding window
-- closes, never by anon users. This keeps the "permanent, never
-- erased" promise trustworthy.
create table if not exists public.quad_champions (
  id          uuid primary key default gen_random_uuid(),
  seat        text not null,
  name        text not null,
  country     text,
  season      int not null,
  winning_bid numeric,
  won_at      timestamptz not null default now()
);
alter table public.quad_champions enable row level security;
create policy "anyone can read champions" on public.quad_champions for select to anon using (true);
-- No insert/update policy for anon — champions are only added by you,
-- via the Supabase dashboard or a service-role script, once a season
-- genuinely closes.

-- ── REGISTER INTEREST (RPC) ─────────────────────────────────────────
-- Inserts (or updates) a registration, generates a referral code,
-- validates any inbound referral code, and returns this registrant's
-- queue position within their seat plus how many people they've
-- referred so far.
-- Changing a function's parameter list creates a new OVERLOAD rather than
-- replacing the old one — drop the original 5-arg signature explicitly so
-- a live project doesn't end up with two register_interest functions,
-- which PostgREST can fail to disambiguate.
drop function if exists public.register_interest(text,text,text,text,text);

create or replace function public.register_interest(
  p_seat text, p_name text, p_email text, p_country text, p_ref_in text, p_bid_hint text default null
) returns table(queue_position bigint, ref_code text, referral_count bigint, seat_total bigint)
language plpgsql security definer
-- search_path pinned: this is SECURITY DEFINER and anon-callable, so anything
-- the body resolves unqualified could otherwise be shadowed and run with the
-- owner's rights. Note gen_random_bytes must then be schema-qualified, because
-- pgcrypto installs into `extensions` on Supabase and is no longer on the path.
set search_path = public, pg_temp
as $$
declare
  v_ref_code text;
  v_referrer_valid boolean := false;
  v_created_at timestamptz;
begin
  if p_ref_in is not null and length(trim(p_ref_in)) > 0 then
    -- Aliased: `ref_code` is also an OUT parameter of this function, and the
    -- unaliased form failed with "column reference ref_code is ambiguous".
    select exists(select 1 from public.quad_interests qi where qi.ref_code = p_ref_in)
      into v_referrer_valid;
  end if;

  insert into public.quad_interests as qt
    (seat, name, email, country, max_bid_hint, ref_code, referred_by)
  values (p_seat, p_name, lower(trim(p_email)), p_country, p_bid_hint,
          encode(extensions.gen_random_bytes(5), 'hex'),
          case when v_referrer_valid then p_ref_in else null end)
  on conflict (seat, email) do update
    set name = excluded.name,
        max_bid_hint = coalesce(excluded.max_bid_hint, qt.max_bid_hint)
  returning qt.ref_code, qt.created_at into v_ref_code, v_created_at;

  return query
  select
    (select count(*) from public.quad_interests q2
       where q2.seat = p_seat and q2.created_at <= v_created_at),
    v_ref_code,
    (select count(*) from public.quad_interests q4 where q4.referred_by = v_ref_code),
    -- seat_total: the page shows "N of 1,000" on the confirmation, which is the
    -- only number that gives anyone a reason to share.
    (select count(*) from public.quad_interests q3 where q3.seat = p_seat);
end;
$$;

revoke all on function public.register_interest(text,text,text,text,text,text) from public;
grant execute on function public.register_interest(text,text,text,text,text,text) to anon;

-- ── ANON PRIVILEGES ─────────────────────────────────────────────────
-- Supabase grants anon broad table privileges by default and leans on RLS.
-- Narrow them to exactly what the page uses, so RLS is not the only thing
-- protecting the email column. TRUNCATE especially: it is not subject to RLS.
revoke all on public.quad_interests from anon;          -- no direct access at all
revoke all on public.quad_seat_counts from anon;
grant select on public.quad_seat_counts to anon;        -- aggregate counts only
revoke all on public.quad_prewarm from anon;
grant insert on public.quad_prewarm to anon;
revoke all on public.quad_champions from anon;
grant select on public.quad_champions to anon;

-- ════════════════════════════════════════════════════════════════════
--  WIRING THE PAGE
-- ════════════════════════════════════════════════════════════════════
--  DONE — index.html is wired and registrations persist. What was actually
--  done, and the one caveat:
--
--  1. A dedicated Supabase project is still the right end state, and this
--     file is written so it can be run against a fresh project unchanged.
--     It was NOT possible now: the organisation's free tier allows two
--     projects and both are in use, so a third needs a paid upgrade. Rather
--     than leave the page unable to record a single registration, every
--     object here is quad_*-prefixed and lives in the Trillioneuro project.
--     This does not weaken either site — the browser only ever holds the
--     publishable key, and per-table RLS is what gates access (anon cannot
--     SELECT quad_interests at all, so the email column is unreachable).
--  2. To split them later: run this file against a new project, then change
--     the two constants in index.html's SUPABASE CONFIG block. Nothing else
--     moves.
--  3. The demo fallback in index.html no longer fabricates a reservation. It
--     used to invent a queue position with Math.random() and show the success
--     card; with no backend it now says registration isn't open and saves
--     nothing, which is the only honest option for a page that cannot store
--     anything.
--  4. Deploy alongside trillioneuro.com in the same repo (see the
--     root vercel.json host-based routing) and point quadrillioneuro.com
--     at the same Vercel project as an additional domain.

-- ─────────────────────────────────────────────────────────────────────
--  LATER (do NOT build yet — here so the foundation supports it):
--  • Real bidding + payment: once a seat crosses 1,000 registrations,
--    open a `quad_bids` table (seat, email, amount, placed_at) behind
--    a proper payment provider (Stripe Checkout, not raw card fields).
--  • Season close: a scheduled job reads the highest confirmed bid,
--    inserts one row into quad_champions, and increments `season`.
--  • Never delete from quad_champions — that table is the permanent
--    promise this whole product is selling.
-- ─────────────────────────────────────────────────────────────────────
