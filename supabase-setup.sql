-- ════════════════════════════════════════════════════════════════════
--  TRILLIONEURO — SUPABASE SETUP
--  Run this whole file in: Supabase dashboard → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════════════

-- ── FOUNDERS TABLE ──────────────────────────────────────────────────
-- Design principle (the airtight foundation):
--   • id           = immutable identity. A founder's existence is permanent.
--   • founder_number = the order they joined. Permanent, never reused.
--   • RANK is NOT stored here. Rank is a computed value (see the view below),
--     so a person's PLACE can change without their RECORD ever changing.
--   This is what lets you promise "your name is here forever" honestly,
--   while ranks stay contestable later.

create table if not exists public.founders (
  id             uuid primary key default gen_random_uuid(),
  founder_number bigint generated always as identity,  -- permanent join order
  name           text not null check (char_length(name) between 1 and 30),
  email          text not null unique,                 -- one place per email
  message        text check (char_length(message) <= 80),
  country        text,
  avatar_url     text,                                 -- set after moderation
  avatar_status  text not null default 'none'          -- none | pending | approved | rejected
                 check (avatar_status in ('none','pending','approved','rejected')),
  created_at     timestamptz not null default now()
);

-- Fast lookups
create index if not exists founders_number_idx  on public.founders (founder_number);
create index if not exists founders_country_idx on public.founders (country);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────────────
alter table public.founders enable row level security;

-- Anyone may reserve a place (insert). They may NOT read others' emails,
-- update, or delete. Public listing is served through a safe view below.
create policy "anyone can reserve a place"
  on public.founders for insert
  to anon
  with check (true);

-- ── PUBLIC VIEW (no emails exposed) ─────────────────────────────────
-- This is what the public record/leaderboard reads from. Note: no email.
create or replace view public.founders_public as
  select
    founder_number,
    name,
    message,
    country,
    case when avatar_status = 'approved' then avatar_url else null end as avatar_url,
    created_at,
    row_number() over (order by founder_number asc) as rank  -- computed, not stored
  from public.founders;

grant select on public.founders_public to anon;

-- ════════════════════════════════════════════════════════════════════
--  THAT'S IT. The launch page can now reserve founders and read the count.
-- ════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
--  WIRING THE PAGE
-- ─────────────────────────────────────────────────────────────────────
--  1. In launch.html, find the SUPABASE CONFIG block near the bottom and
--     paste your values:
--        const SUPABASE_URL      = 'https://xxxx.supabase.co';
--        const SUPABASE_ANON_KEY = 'eyJ...';   (the public "anon" key)
--     Get both from: Project Settings → API.
--
--  2. Set displayBase = 0 in launch.html if you want the counter to show
--     your REAL founder count from zero. (It currently starts at 3418 as a
--     demo placeholder — change to 0 before going live, or keep a small
--     head-start number if you prefer. Your call, but real is more honest.)
--
--  3. Deploy launch.html to Vercel (or Cloudflare Pages) and point
--     trillioneuro.com at it. Done — you're collecting real founders.


-- ─────────────────────────────────────────────────────────────────────
--  EXPORT YOUR FOUNDER LIST ANY TIME
-- ─────────────────────────────────────────────────────────────────────
--  Supabase → Table Editor → founders → Export to CSV.
--  Or in SQL:  select name, email, country, created_at from founders order by founder_number;


-- ─────────────────────────────────────────────────────────────────────
--  LATER (do NOT build yet — here so the foundation supports it):
--  • Avatars: upload to Supabase Storage, set avatar_status = 'pending',
--    approve in a review screen before it ever shows publicly.
--  • €1 renewal (year two): add a `payments` table referencing founders.id.
--    Never change founder_number — only add payment rows.
--  • Rank bidding: ranks already live in a computed view, so you can layer a
--    separate `rank_overrides` / auction system on top WITHOUT touching the
--    permanent founders record. Identity stays immutable; rank stays fluid.
-- ─────────────────────────────────────────────────────────────────────

-- Email-only pre-registrations (captured on hero email blur before modal)
CREATE TABLE IF NOT EXISTS founder_interests (
  id        bigserial PRIMARY KEY,
  email     text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE founder_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON founder_interests FOR INSERT TO anon WITH CHECK (true);
