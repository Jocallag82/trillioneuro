-- ════════════════════════════════════════════════════════════════════
--  QUADRILLIONEURO — SUPABASE SETUP
--  Run this whole file in: Supabase dashboard → SQL Editor → New query → Run
--  NOTE: this has not been executed against a live project — sanity-check
--  it in the SQL editor before relying on it in production.
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
create or replace function public.register_interest(
  p_seat text, p_name text, p_email text, p_country text, p_ref_in text
) returns table(queue_position bigint, ref_code text, referral_count bigint)
language plpgsql security definer as $$
declare
  v_ref_code text;
  v_referrer_valid boolean := false;
  v_created_at timestamptz;
begin
  if p_ref_in is not null and length(trim(p_ref_in)) > 0 then
    select exists(select 1 from public.quad_interests where ref_code = p_ref_in) into v_referrer_valid;
  end if;

  insert into public.quad_interests (seat, name, email, country, ref_code, referred_by)
  values (p_seat, p_name, p_email, p_country, encode(gen_random_bytes(5), 'hex'),
          case when v_referrer_valid then p_ref_in else null end)
  on conflict (seat, email) do update set name = excluded.name
  returning quad_interests.ref_code, quad_interests.created_at into v_ref_code, v_created_at;

  return query
  select
    (select count(*) from public.quad_interests q2
       where q2.seat = p_seat and q2.created_at <= v_created_at) as queue_position,
    v_ref_code as ref_code,
    (select count(*) from public.quad_interests where referred_by = v_ref_code) as referral_count;
end;
$$;

grant execute on function public.register_interest(text,text,text,text,text) to anon;

-- ════════════════════════════════════════════════════════════════════
--  WIRING THE PAGE
-- ════════════════════════════════════════════════════════════════════
--  1. Create a new Supabase project for Quadrillioneuro (keep it
--     separate from Trillioneuro's project — different business,
--     different data).
--  2. In index.html, find the SUPABASE CONFIG block near the bottom
--     and replace:
--        const SUPABASE_URL      = 'https://xxxx.supabase.co';
--        const SUPABASE_ANON_KEY = 'eyJ...';   (the public "anon" key)
--     Get both from: Project Settings → API.
--  3. Until you do this, the page runs in local demo mode automatically
--     (LIVE flag checks for the 'YOUR-PROJECT' placeholder) — the
--     claim flow still completes end-to-end for testing, it just
--     doesn't persist anywhere.
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
