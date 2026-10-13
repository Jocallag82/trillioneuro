-- Red Teddy Tutor: learning engine evidence, older age bands, AI tutor quotas.
-- Applied to project kxzywyflylkcqoidiqmo on 2026-10-12. Additive: no existing
-- column is changed or dropped, and existing rows stay valid.

-- 1. Richer evidence per answer. All nullable: rows written by older clients
--    (first_try only) remain valid and are read conservatively by learner.js.
alter table public.rtt_attempts
  add column if not exists correct boolean,
  add column if not exists hints smallint check (hints between 0 and 10),
  add column if not exists difficulty smallint check (difficulty between 1 and 3),
  add column if not exists misconception text check (misconception ~ '^[a-z-]{2,40}$'),
  add column if not exists source text check (source in ('practice', 'diagnostic', 'review', 'game', 'library'));

create index if not exists rtt_attempts_profile_skill_idx on public.rtt_attempts (profile_id, skill, created_at);
create index if not exists rtt_sessions_profile_idx on public.rtt_sessions (profile_id, created_at);

-- 2. Primary-age bands and a locale per child.
alter table public.rtt_profiles drop constraint if exists rtt_profiles_age_band_check;
alter table public.rtt_profiles add constraint rtt_profiles_age_band_check
  check (age_band in ('2-3', '3-5', '5-7', '7-9', '9-11'));
alter table public.rtt_profiles
  add column if not exists locale text check (locale in ('en-GB', 'en-IE', 'en-US', 'en-AU'));

-- 3. Least privilege. RLS does not apply to TRUNCATE, and nothing needs UPDATE
--    on answers, so signed-in users get only what the policies cover.
revoke truncate, references, trigger on public.rtt_profiles, public.rtt_attempts, public.rtt_sessions from authenticated;
revoke update on public.rtt_attempts, public.rtt_sessions from authenticated;
revoke all on public.rtt_profiles, public.rtt_attempts, public.rtt_sessions from anon;

-- 4. Entitlements. Written only by the service role (a future billing webhook).
--    No row means the free plan. No billing provider is connected yet.
create table if not exists public.rtt_entitlements (
  parent_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus')),
  valid_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.rtt_entitlements enable row level security;
revoke all on public.rtt_entitlements from anon, authenticated;
grant select on public.rtt_entitlements to authenticated;
drop policy if exists "parents read own entitlement" on public.rtt_entitlements;
create policy "parents read own entitlement" on public.rtt_entitlements
  for select to authenticated using (parent_id = (select auth.uid()));

-- 5. AI tutor usage: counts and tokens only. No message text is stored.
create table if not exists public.rtt_tutor_usage (
  parent_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  turns integer not null default 0 check (turns >= 0),
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  failures integer not null default 0,
  minute_start timestamptz,
  minute_turns integer not null default 0,
  primary key (parent_id, day)
);
alter table public.rtt_tutor_usage enable row level security;
revoke all on public.rtt_tutor_usage from anon, authenticated;
grant select on public.rtt_tutor_usage to authenticated;
drop policy if exists "parents read own usage" on public.rtt_tutor_usage;
create policy "parents read own usage" on public.rtt_tutor_usage
  for select to authenticated using (parent_id = (select auth.uid()));

-- Reserves one tutor turn for a child the caller owns. Enforces the daily plan
-- limit and a per-minute burst limit. Returns the child's age band and locale for
-- the prompt; never the nickname or anything else identifying.
create or replace function public.rtt_tutor_begin(p_profile uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_band text;
  v_locale text;
  v_plan text := 'free';
  v_limit int;
  v_row public.rtt_tutor_usage;
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'signed-out');
  end if;
  select age_band, locale into v_band, v_locale
    from public.rtt_profiles where id = p_profile and parent_id = v_uid;
  if v_band is null then
    return jsonb_build_object('allowed', false, 'reason', 'no-profile');
  end if;
  select e.plan into v_plan from public.rtt_entitlements e
    where e.parent_id = v_uid and (e.valid_until is null or e.valid_until > now());
  v_plan := coalesce(v_plan, 'free');
  v_limit := case v_plan when 'plus' then 200 else 20 end;

  insert into public.rtt_tutor_usage (parent_id, day) values (v_uid, v_today)
    on conflict (parent_id, day) do nothing;
  select * into v_row from public.rtt_tutor_usage
    where parent_id = v_uid and day = v_today for update;

  if v_row.turns >= v_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily-limit', 'plan', v_plan, 'limit', v_limit, 'remaining', 0);
  end if;
  if v_row.minute_start is not null and v_row.minute_start > now() - interval '1 minute' and v_row.minute_turns >= 6 then
    return jsonb_build_object('allowed', false, 'reason', 'slow-down', 'plan', v_plan, 'limit', v_limit, 'remaining', v_limit - v_row.turns);
  end if;

  update public.rtt_tutor_usage set
    turns = turns + 1,
    minute_start = case when minute_start is null or minute_start <= now() - interval '1 minute' then now() else minute_start end,
    minute_turns = case when minute_start is null or minute_start <= now() - interval '1 minute' then 1 else minute_turns + 1 end
    where parent_id = v_uid and day = v_today;

  return jsonb_build_object('allowed', true, 'plan', v_plan, 'limit', v_limit,
    'remaining', v_limit - v_row.turns - 1, 'band', v_band, 'locale', v_locale);
end;
$$;

-- Records what a turn cost. A failed model call refunds the turn.
create or replace function public.rtt_tutor_finish(p_input int, p_output int, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  update public.rtt_tutor_usage set
    input_tokens = input_tokens + greatest(0, least(coalesce(p_input, 0), 100000)),
    output_tokens = output_tokens + greatest(0, least(coalesce(p_output, 0), 100000)),
    failures = failures + case when p_ok then 0 else 1 end,
    turns = case when p_ok then turns else greatest(0, turns - 1) end
  where parent_id = v_uid and day = (now() at time zone 'utc')::date;
end;
$$;

revoke all on function public.rtt_tutor_begin(uuid) from public, anon;
revoke all on function public.rtt_tutor_finish(int, int, boolean) from public, anon;
grant execute on function public.rtt_tutor_begin(uuid) to authenticated;
grant execute on function public.rtt_tutor_finish(int, int, boolean) to authenticated;
