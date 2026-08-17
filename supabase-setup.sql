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

-- ── MIGRATION: referral columns ──────────────────────────────────────
-- This whole file is safe to re-run against a LIVE project that already
-- has founders in it (the CREATE TABLE above is a no-op in that case —
-- it does NOT retroactively add new columns). These statements do that
-- migration explicitly: add the columns nullable, backfill any existing
-- rows with a generated code, then lock in NOT NULL + UNIQUE.
alter table public.founders add column if not exists ref_code    text;
alter table public.founders add column if not exists referred_by text; -- another founder's ref_code, nullable
                                                                        -- (attribution only — never affects founder_number/rank)
update public.founders set ref_code = encode(gen_random_bytes(5), 'hex') where ref_code is null;
alter table public.founders alter column ref_code set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'founders_ref_code_key') then
    alter table public.founders add constraint founders_ref_code_key unique (ref_code);
  end if;
end $$;
create index if not exists founders_referred_by_idx on public.founders (referred_by);

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

-- ── ANON PRIVILEGES ─────────────────────────────────────────────────
-- Supabase grants anon broad table privileges by default and relies on RLS to
-- gate them. That works — an anon SELECT on founders returns nothing, because
-- the only policy above is for INSERT — but it makes RLS the single thing
-- standing between a future config slip and the founder email list.
--
-- TRUNCATE is the specific reason to narrow it: unlike SELECT/INSERT/UPDATE/
-- DELETE, TRUNCATE is NOT subject to row level security, and it was granted to
-- anon on all three objects.
--
-- So: revoke everything, then grant back exactly what index.html uses.
--   founders          INSERT only — creation goes through reserve_founder()
--                     (SECURITY DEFINER, needs no anon privilege); the INSERT
--                     grant keeps the documented RLS backstop usable.
--   founders_public   SELECT only — it is a read view. It was also granted
--                     INSERT/UPDATE/DELETE, which failed only because the
--                     window function makes it non-auto-updatable. Luck, not
--                     design.
--   founder_interests INSERT only — the email capture is an upsert with
--                     ignoreDuplicates, i.e. INSERT ... ON CONFLICT DO NOTHING.
revoke all on public.founders from anon;
grant insert on public.founders to anon;

revoke all on public.founders_public from anon;
grant select on public.founders_public to anon;

-- ── RESERVE FOUNDER (RPC) ────────────────────────────────────────────
-- The launch page calls this via sb.rpc('reserve_founder', {...}) — it is
-- the ONLY way founders get created (the RLS insert policy above exists
-- as a backstop, not a second entry point). Inserts the founder, generates
-- their own shareable referral code, validates any inbound referral code,
-- and returns founder_number (permanent, for the "you're #X" share card)
-- plus how many people have joined through their link so far.
--
-- Referrals are attribution-only: they never change founder_number or
-- rank. That's deliberate — Trillioneuro's entire promise is an honest,
-- immutable join order. A "share to jump the queue" mechanic would
-- directly contradict that. (Quadrillioneuro's queue-jump referral model
-- is fine there because seats don't claim to be a permanent chronological
-- record the way this one does.)
create or replace function public.reserve_founder(
  p_name text, p_email text, p_message text default null,
  p_country text default null, p_ref_in text default null
) returns table(founder_number bigint, ref_code text, referral_count bigint)
language plpgsql security definer
-- search_path is pinned, and it is not optional here.
--
-- This function is SECURITY DEFINER by design: it is the only way a founder
-- row is created, so anon never needs write access to public.founders itself.
-- But a DEFINER function with a caller-influenced search_path is the classic
-- privilege-escalation shape — anything the body references unqualified can be
-- shadowed by an object in a schema that resolves earlier, and that shadowed
-- code then runs with the owner's rights.
--
-- The earlier FOUR-argument version of this function did have search_path set.
-- When p_ref_in was added, `create or replace` with a new signature created a
-- second function rather than replacing the first, and the new one — the one
-- index.html actually calls — inherited nothing. Supabase's linter flags it as
-- 0011_function_search_path_mutable. The stale 4-arg overload is dropped just
-- below, so there is one anon-callable entry point rather than two.
--
-- pg_temp is pinned last so a temp object cannot take precedence either.
set search_path = public, pg_temp
as $$
declare
  v_founder_number bigint;
  v_ref_code text;
  v_referrer_valid boolean := false;
begin
  if p_ref_in is not null and length(trim(p_ref_in)) > 0 then
    select exists(select 1 from public.founders f where f.ref_code = p_ref_in) into v_referrer_valid;
  end if;

  insert into public.founders (name, email, message, country, ref_code, referred_by)
  values (
    p_name, p_email, p_message, p_country,
    encode(gen_random_bytes(5), 'hex'),
    case when v_referrer_valid then p_ref_in else null end
  )
  returning founders.founder_number, founders.ref_code
  into v_founder_number, v_ref_code;

  return query
  select
    v_founder_number,
    v_ref_code,
    (select count(*) from public.founders f2 where f2.referred_by = v_ref_code);
end;
$$;

grant execute on function public.reserve_founder(text,text,text,text,text) to anon;

-- Retire the pre-referral overload.
--
-- `create or replace` above only replaces a function with a MATCHING argument
-- list, so adding p_ref_in left the old four-argument version in place and
-- still granted to anon. Two live entry points, and the older one writes a
-- founder row without recording who referred them — so referral counts could
-- be bypassed by calling the RPC directly with four arguments.
--
-- Safe to drop: index.html sends all five named arguments, and it is the only
-- caller in the repo.
drop function if exists public.reserve_founder(text,text,text,text);

-- ════════════════════════════════════════════════════════════════════
--  THAT'S IT. The launch page can now reserve founders and read the count.
-- ════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
--  WIRING THE PAGE
-- ─────────────────────────────────────────────────────────────────────
--  1. Run this WHOLE file (it's safe to re-run against a live project —
--     see the MIGRATION comment above the referral columns).
--  2. In index.html, the SUPABASE CONFIG block near the bottom already
--     has real project keys wired in — nothing to change there.
--  3. Push to GitHub → Vercel auto-deploys. Done — you're collecting
--     real founders (and, as of the referral migration, real ref codes).


-- ─────────────────────────────────────────────────────────────────────
--  EXPORT YOUR FOUNDER LIST ANY TIME
-- ─────────────────────────────────────────────────────────────────────
--  Supabase → Table Editor → founders → Export to CSV.
--  Or in SQL:  select name, email, country, created_at from founders order by founder_number;


-- ─────────────────────────────────────────────────────────────────────
--  LATER (do NOT build yet — here so the foundation supports it):
--  • Avatars: upload to Supabase Storage, set avatar_status = 'pending',
--    approve in a review screen before it ever shows publicly. The
--    upload control was removed from index.html's claim modal for now —
--    it was previewing files client-side but never persisting them
--    anywhere, which silently broke the "reviewed before going live"
--    promise. Bring it back once the storage + moderation step exists.
--  • €1/year badge renewal (starting year two): add a `payments` table
--    (founder_id, year, paid_at) and derive badge_active from whether the
--    current year has a paid row. Never remove/alter the founders row or
--    founder_number for a lapsed payment — the record entry is permanent
--    regardless; only the Founder badge depends on renewal.
--  • Rank bidding: ranks already live in a computed view, so you can layer a
--    separate `rank_overrides` / auction system on top WITHOUT touching the
--    permanent founders record. Identity stays immutable; rank stays fluid.
--  • Notification email when the record goes live at 10,000 founders: no
--    infrastructure exists yet to actually send this (no Edge Function,
--    no mail provider wired). The modal promises "we'll email you the
--    moment it goes live" — keep that promise true by building this
--    before the threshold is hit, not by removing the copy.
-- ─────────────────────────────────────────────────────────────────────

-- Email-only pre-registrations (captured on hero email blur before modal)
CREATE TABLE IF NOT EXISTS founder_interests (
  id        bigserial PRIMARY KEY,
  email     text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE founder_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON founder_interests FOR INSERT TO anon WITH CHECK (true);

-- Same narrowing as founders above: anon needs INSERT and nothing else. These
-- are captured email addresses, and TRUNCATE is not covered by RLS.
revoke all on public.founder_interests from anon;
grant insert on public.founder_interests to anon;
