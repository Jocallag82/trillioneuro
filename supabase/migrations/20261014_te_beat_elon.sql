-- ════════════════════════════════════════════════════════════════════
--  TRILLIONEURO — BEAT ELON + THE FOUNDERS' RECORD
--
--  Additive only. Every object is te_*-prefixed. The legacy free-claim
--  table `founders` is left exactly as it is (its rows are not paid
--  entries and are never mixed into the paid record).
--
--  SECURITY MODEL
--   • anon / authenticated hold NO privilege on any te_* table. Every read
--     and write is a SECURITY DEFINER function with a pinned search_path
--     that returns only public columns.
--   • Paid entries are created ONLY by te_finalize_payment(), executable
--     only by service_role (the Stripe webhook). A browser can never mint
--     an entry number.
--   • Entry numbers come from one row-locked counter, assigned inside the
--     same transaction that records the verified payment. A failed,
--     cancelled or unverified payment never consumes a number.
--   • Admin functions check te_is_admin() (auth.uid() in te_admins) on
--     the server and write an audit row.
--  Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── Settings / feature flags ─────────────────────────────────────────
create table if not exists public.te_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.te_settings enable row level security;
insert into public.te_settings (key, value) values
  ('payments_enabled',      'false'::jsonb),   -- master switch (also gated by env on the server)
  ('price_cents',           '1900'::jsonb),
  ('currency',              '"eur"'::jsonb),
  ('target_eur',            '1000000000000'::jsonb),
  ('challenge_started_on',  'null'::jsonb),    -- set by the founder; never guessed
  ('waitlist_enabled',      'true'::jsonb),
  ('operator_name',         'null'::jsonb),    -- legal trader identity; required before checkout
  ('operator_address',      'null'::jsonb),    -- geographic address; required before checkout
  ('operator_email',        '"hello@trillioneuro.com"'::jsonb),
  ('referral_salt',         to_jsonb(encode(extensions.gen_random_bytes(16), 'hex')))
on conflict (key) do nothing;

create or replace function public.te_setting(p_key text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select value from public.te_settings where key = p_key
$$;
revoke all on function public.te_setting(text) from public, anon, authenticated;

-- ── Countries (maintained dataset; populations sourced + dated) ──────
create table if not exists public.te_countries (
  code              text primary key check (code ~ '^[A-Z]{2}$'),
  name              text not null,
  region            text,
  lat               numeric,
  lng               numeric,
  population        bigint check (population is null or population > 0),
  population_year   integer,
  population_source text,
  active            boolean not null default true
);
alter table public.te_countries enable row level security;

-- ── Admins + audit ───────────────────────────────────────────────────
create table if not exists public.te_admins (
  user_id    uuid primary key,
  email      text not null,
  created_at timestamptz not null default now()
);
alter table public.te_admins enable row level security;

create table if not exists public.te_audit_log (
  id         bigserial primary key,
  actor      text not null,          -- admin user id, 'stripe', or 'system'
  action     text not null,
  target     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);
alter table public.te_audit_log enable row level security;
create index if not exists te_audit_created_idx on public.te_audit_log (created_at desc);

create or replace function public.te_is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and exists (select 1 from public.te_admins where user_id = auth.uid())
$$;
revoke all on function public.te_is_admin() from public, anon;
grant execute on function public.te_is_admin() to authenticated;

create or replace function public.te_require_admin() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.te_is_admin() then
    raise exception 'FORBIDDEN: administrator access required' using errcode = '42501';
  end if;
  return auth.uid();
end $$;
revoke all on function public.te_require_admin() from public, anon, authenticated;

create or replace function public.te_audit(p_action text, p_target text, p_detail jsonb)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.te_audit_log (actor, action, target, detail)
  values (coalesce(auth.uid()::text, 'system'), p_action, p_target, p_detail)
$$;
revoke all on function public.te_audit(text,text,jsonb) from public, anon, authenticated;

-- ── Drafts (pre-payment; never hold a number) ────────────────────────
create table if not exists public.te_drafts (
  id                 uuid primary key default gen_random_uuid(),
  nickname           text not null check (char_length(nickname) between 2 and 32),
  real_name          text check (real_name is null or char_length(real_name) between 2 and 60),
  show_real_name     boolean not null default false,
  country            text not null references public.te_countries(code),
  message            text check (message is null or char_length(message) <= 280),
  email              text not null check (char_length(email) <= 254),
  ref_in             text,
  price_cents        integer not null,
  currency           text not null,
  terms_version      text not null,
  consent_at         timestamptz not null default now(),
  status             text not null default 'draft'
                     check (status in ('draft','checkout','paid','expired','failed','cancelled')),
  stripe_session_id  text unique,
  checkout_attempts  integer not null default 0,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '24 hours'
);
alter table public.te_drafts enable row level security;
create index if not exists te_drafts_status_idx on public.te_drafts (status, created_at);

-- ── Entry counter (single row, row-locked) ───────────────────────────
create table if not exists public.te_counter (
  id   boolean primary key default true check (id),
  last bigint not null default 0
);
alter table public.te_counter enable row level security;
insert into public.te_counter (id, last) values (true, 0) on conflict do nothing;

-- ── Entries (verified, paid) ─────────────────────────────────────────
create table if not exists public.te_entries (
  id                     uuid primary key default gen_random_uuid(),
  entry_number           bigint not null unique check (entry_number > 0),
  draft_id               uuid not null unique references public.te_drafts(id),
  nickname               text not null,
  real_name              text,
  show_real_name         boolean not null default false,
  country                text not null references public.te_countries(code),
  message                text,
  message_hidden         boolean not null default false,
  email                  text not null,
  ref_code               text not null unique,
  referred_by            uuid references public.te_entries(id),
  public_referrals       boolean not null default true,
  status                 text not null default 'active'
                         check (status in ('active','refunded','removed')),
  moderation             text not null default 'pending'
                         check (moderation in ('pending','approved','hidden')),
  stripe_session_id      text not null unique,
  stripe_payment_intent  text unique,
  amount_cents           integer not null,
  currency               text not null,
  manage_key_hash        text unique,
  manage_key_revealed    boolean not null default false,
  paid_at                timestamptz not null default now(),
  refunded_at            timestamptz,
  updated_at             timestamptz not null default now()
);
alter table public.te_entries enable row level security;
create index if not exists te_entries_country_idx  on public.te_entries (country) where status = 'active';
create index if not exists te_entries_paid_idx     on public.te_entries (paid_at);
create index if not exists te_entries_referred_idx on public.te_entries (referred_by);
create index if not exists te_entries_nick_trgm_idx on public.te_entries (lower(nickname) text_pattern_ops);

-- Entry number, payment and identity columns are immutable once written.
create or replace function public.te_entries_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.entry_number <> old.entry_number or new.draft_id <> old.draft_id
     or new.stripe_session_id <> old.stripe_session_id or new.amount_cents <> old.amount_cents
     or new.paid_at <> old.paid_at or new.ref_code <> old.ref_code then
    raise exception 'IMMUTABLE: entry number, payment and referral identity cannot change';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists te_entries_guard on public.te_entries;
create trigger te_entries_guard before update on public.te_entries
  for each row execute function public.te_entries_guard();

-- ── Payment events (idempotency ledger) ──────────────────────────────
create table if not exists public.te_payment_events (
  event_id    text primary key,
  type        text not null,
  session_id  text,
  result      text,
  received_at timestamptz not null default now()
);
alter table public.te_payment_events enable row level security;

-- ── Referral clicks ──────────────────────────────────────────────────
create table if not exists public.te_referral_clicks (
  id         bigserial primary key,
  entry_id   uuid not null references public.te_entries(id),
  visitor    text not null,           -- salted hash of IP + UA; never the raw IP
  valid      boolean not null,
  reason     text,
  created_at timestamptz not null default now()
);
alter table public.te_referral_clicks enable row level security;
create index if not exists te_refclicks_entry_idx on public.te_referral_clicks (entry_id, created_at);
create index if not exists te_refclicks_visitor_idx on public.te_referral_clicks (visitor, created_at);

-- ── Waitlist, reports, privacy requests, contact ─────────────────────
create table if not exists public.te_waitlist (
  id         bigserial primary key,
  email      text not null unique,
  draft_id   uuid references public.te_drafts(id),
  country    text,
  created_at timestamptz not null default now()
);
alter table public.te_waitlist enable row level security;

create table if not exists public.te_reports (
  id           bigserial primary key,
  entry_number bigint,
  reason       text not null check (reason in ('offensive','hate','personal_data','impersonation','spam','illegal','other')),
  details      text check (char_length(details) <= 1000),
  email        text,
  status       text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolution   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
alter table public.te_reports enable row level security;

create table if not exists public.te_privacy_requests (
  id           bigserial primary key,
  entry_number bigint,
  email        text not null,
  kind         text not null check (kind in ('correction','hide_name','hide_message','removal','access','erasure','other')),
  details      text check (char_length(details) <= 2000),
  status       text not null default 'open' check (status in ('open','completed','rejected')),
  resolution   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
alter table public.te_privacy_requests enable row level security;

create table if not exists public.te_messages (
  id         bigserial primary key,
  name       text,
  email      text not null,
  topic      text not null check (topic in ('general','support','payment','press','privacy')),
  body       text not null check (char_length(body) between 5 and 4000),
  status     text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
alter table public.te_messages enable row level security;

-- ── Journal, milestones, metrics ─────────────────────────────────────
create table if not exists public.te_journal (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title       text not null check (char_length(title) between 3 and 140),
  excerpt     text check (char_length(excerpt) <= 300),
  body        text not null default '',
  cover_url   text check (cover_url is null or cover_url ~ '^https://'),
  categories  text[] not null default '{}',
  status      text not null default 'draft' check (status in ('draft','scheduled','published')),
  publish_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.te_journal enable row level security;
create index if not exists te_journal_pub_idx on public.te_journal (status, publish_at desc);

create table if not exists public.te_milestones (
  id          uuid primary key default gen_random_uuid(),
  occurred_on date not null,
  title       text not null check (char_length(title) between 3 and 140),
  detail      text check (char_length(detail) <= 1000),
  kind        text not null check (kind in ('launch','milestone','setback','update')),
  verified    boolean not null default false,
  source_url  text check (source_url is null or source_url ~ '^https://'),
  journal_slug text,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.te_milestones enable row level security;

create table if not exists public.te_metrics (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('personal_net_worth','company_equity_value','company_revenue','cash_holdings','other')),
  label       text not null check (char_length(label) between 2 and 120),
  amount      numeric not null,
  currency    text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  as_of       date not null,
  source      text not null check (char_length(source) between 3 and 500),
  methodology text not null check (char_length(methodology) between 10 and 4000),
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.te_metrics enable row level security;

revoke all on public.te_settings, public.te_countries, public.te_admins, public.te_audit_log,
  public.te_drafts, public.te_counter, public.te_entries, public.te_payment_events,
  public.te_referral_clicks, public.te_waitlist, public.te_reports, public.te_privacy_requests,
  public.te_messages, public.te_journal, public.te_milestones, public.te_metrics
  from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
--  HELPERS
-- ════════════════════════════════════════════════════════════════════
create or replace function public.te_valid_email(p text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select p is not null and char_length(p) <= 254 and p ~ '^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$'
$$;

create or replace function public.te_referral_title(n bigint) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case when n >= 100 then 'Legend' when n >= 25 then 'Vanguard'
              when n >= 10 then 'Standard-Bearer' when n >= 3 then 'Herald'
              when n >= 1 then 'Ally' else null end
$$;

-- Public shape of an entry. Real name only with explicit consent and when not
-- hidden by moderation; message only when not hidden.
create or replace function public.te_entry_json(e public.te_entries) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'entry_number', e.entry_number,
    'nickname',     e.nickname,
    'real_name',    case when e.show_real_name and e.moderation <> 'hidden' then e.real_name end,
    'country',      e.country,
    'country_name', (select name from public.te_countries c where c.code = e.country),
    'message',      case when e.message_hidden or e.moderation = 'hidden' then null else e.message end,
    'entered_at',   e.paid_at,
    'verified',     true,
    'indexable',    e.moderation = 'approved',
    'referrals',    case when e.public_referrals then
                      (select count(*) from public.te_entries r where r.referred_by = e.id and r.status = 'active') end,
    'title',        case when e.public_referrals then public.te_referral_title(
                      (select count(*) from public.te_entries r where r.referred_by = e.id and r.status = 'active')) end
  )
$$;
revoke all on function public.te_entry_json(public.te_entries) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
--  PUBLIC READS
-- ════════════════════════════════════════════════════════════════════
create or replace function public.te_public_settings() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'payments_enabled',     public.te_setting('payments_enabled'),
    'price_cents',          public.te_setting('price_cents'),
    'currency',             public.te_setting('currency'),
    'target_eur',           public.te_setting('target_eur'),
    'challenge_started_on', public.te_setting('challenge_started_on'),
    'waitlist_enabled',     public.te_setting('waitlist_enabled'),
    'operator_name',        public.te_setting('operator_name'),
    'operator_address',     public.te_setting('operator_address'),
    'operator_email',       public.te_setting('operator_email')
  )
$$;

create or replace function public.te_stats() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'entries',   (select count(*) from public.te_entries where status = 'active'),
    'countries', (select count(distinct country) from public.te_entries where status = 'active'),
    'latest_entry_at', (select max(paid_at) from public.te_entries where status = 'active'),
    'net_worth', (select jsonb_build_object('amount', amount, 'currency', currency, 'as_of', as_of,
                         'source', source, 'methodology', methodology, 'label', label)
                    from public.te_metrics where kind = 'personal_net_worth' and published
                   order by as_of desc, created_at desc limit 1),
    'settings',  public.te_public_settings()
  )
$$;

-- Archive: search by number or nickname, filter by country, sort, paginate.
create or replace function public.te_record(
  p_q text default null, p_country text default null, p_sort text default 'newest',
  p_limit integer default 24, p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_q text; v_num bigint; v_limit int; v_offset int; v_rows jsonb; v_total bigint;
begin
  v_q := nullif(left(btrim(coalesce(p_q, '')), 40), '');
  v_q := ltrim(coalesce(v_q, ''), '#');
  v_q := nullif(v_q, '');
  if v_q ~ '^[0-9]{1,12}$' then v_num := v_q::bigint; end if;
  v_limit := least(greatest(coalesce(p_limit, 24), 1), 60);
  v_offset := least(greatest(coalesce(p_offset, 0), 0), 100000);

  with f as (
    select e.* from public.te_entries e
     where e.status = 'active'
       and (p_country is null or p_country = '' or e.country = upper(p_country))
       and (v_q is null
            or (v_num is not null and e.entry_number = v_num)
            or lower(e.nickname) like '%' || replace(replace(replace(lower(v_q), '\', '\\'), '%', '\%'), '_', '\_') || '%')
  )
  select (select count(*) from f),
         coalesce((select jsonb_agg(public.te_entry_json(x::public.te_entries) order by
                     case when p_sort = 'oldest' then x.entry_number end asc,
                     case when p_sort <> 'oldest' then x.entry_number end desc)
                   from (select * from f
                          order by case when p_sort = 'oldest' then f.entry_number end asc,
                                   case when p_sort <> 'oldest' then f.entry_number end desc
                          limit v_limit offset v_offset) x), '[]'::jsonb)
    into v_total, v_rows;
  return jsonb_build_object('total', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
end $$;

create or replace function public.te_entry(p_number bigint) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select public.te_entry_json(e) from public.te_entries e
   where e.entry_number = p_number and e.status = 'active'
$$;

-- Country leaderboard: counts, population-adjusted rate, rank now vs 7 days ago.
create or replace function public.te_country_stats() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with now_c as (
    select country, count(*) n from public.te_entries where status = 'active' group by country
  ), prev_c as (
    select country, count(*) n from public.te_entries
     where status = 'active' and paid_at < now() - interval '7 days' group by country
  ), ranked as (
    select c.code, c.name, c.region, c.lat, c.lng, c.population, c.population_year, c.population_source,
           coalesce(n.n, 0) as entries,
           case when c.population > 0 and n.n > 0 then round(n.n::numeric * 1000000 / c.population, 3) end as per_million,
           case when n.n > 0 then rank() over (order by coalesce(n.n,0) desc) end as rank,
           case when p.n > 0 then rank() over (order by coalesce(p.n,0) desc) end as rank_7d
      from public.te_countries c
      left join now_c n on n.country = c.code
      left join prev_c p on p.country = c.code
     where c.active
  )
  select coalesce(jsonb_agg(to_jsonb(r) order by r.entries desc, r.name), '[]'::jsonb) from ranked r
$$;

create or replace function public.te_countries_list() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name) order by name), '[]'::jsonb)
    from public.te_countries where active
$$;

create or replace function public.te_referral_board(p_limit integer default 50) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(x order by x.referrals desc, x.entry_number), '[]'::jsonb) from (
    select e.entry_number, e.nickname, e.country, count(r.id) as referrals,
           public.te_referral_title(count(r.id)) as title
      from public.te_entries e
      join public.te_entries r on r.referred_by = e.id and r.status = 'active'
     where e.status = 'active' and e.public_referrals and e.moderation <> 'hidden'
     group by e.id
     order by count(r.id) desc, e.entry_number
     limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ) x
$$;

create or replace function public.te_journal_list(p_limit integer default 20) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'title', title, 'excerpt', excerpt,
           'cover_url', cover_url, 'categories', categories, 'published_at', coalesce(publish_at, created_at))
           order by coalesce(publish_at, created_at) desc), '[]'::jsonb)
    from (select * from public.te_journal
           where status = 'published' or (status = 'scheduled' and publish_at <= now())
           order by coalesce(publish_at, created_at) desc
           limit least(greatest(coalesce(p_limit, 20), 1), 100)) j
$$;

create or replace function public.te_journal_get(p_slug text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('slug', slug, 'title', title, 'excerpt', excerpt, 'body', body,
           'cover_url', cover_url, 'categories', categories,
           'published_at', coalesce(publish_at, created_at), 'updated_at', updated_at,
           'milestones', (select coalesce(jsonb_agg(jsonb_build_object('title', m.title, 'occurred_on', m.occurred_on,
                            'kind', m.kind, 'verified', m.verified, 'source_url', m.source_url)), '[]'::jsonb)
                            from public.te_milestones m where m.journal_slug = j.slug and m.published))
    from public.te_journal j
   where slug = p_slug and (status = 'published' or (status = 'scheduled' and publish_at <= now()))
$$;

create or replace function public.te_milestones_list() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('occurred_on', occurred_on, 'title', title, 'detail', detail,
           'kind', kind, 'verified', verified, 'source_url', source_url, 'journal_slug', journal_slug)
           order by occurred_on desc), '[]'::jsonb)
    from public.te_milestones where published
$$;

create or replace function public.te_metrics_list() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'label', label, 'amount', amount, 'currency', currency,
           'as_of', as_of, 'source', source, 'methodology', methodology) order by as_of desc), '[]'::jsonb)
    from public.te_metrics where published
$$;

-- ════════════════════════════════════════════════════════════════════
--  PUBLIC WRITES (validated, rate-limited)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.te_create_draft(
  p_nickname text, p_country text, p_email text,
  p_real_name text default null, p_show_real_name boolean default false,
  p_message text default null, p_ref text default null,
  p_accept_terms boolean default false, p_terms_version text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_nick text; v_real text; v_msg text; v_email text; v_country text; v_ref text; v_id uuid; v_exp timestamptz;
begin
  if not public.rl_allow('te_create_draft', 20, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts, try again later' using errcode = '54000';
  end if;
  if coalesce(p_accept_terms, false) is not true then
    raise exception 'TERMS_REQUIRED: you must accept the terms' using errcode = '22023';
  end if;
  v_nick  := public.clean_text(p_nickname);
  v_real  := public.clean_text(p_real_name);
  v_msg   := public.clean_text(p_message);
  v_email := lower(btrim(coalesce(p_email, '')));
  v_country := upper(btrim(coalesce(p_country, '')));
  if v_nick is null or char_length(v_nick) not between 2 and 32 then
    raise exception 'INVALID_NICKNAME: nickname must be 2-32 characters' using errcode = '22023';
  end if;
  if v_real is not null and char_length(v_real) not between 2 and 60 then
    raise exception 'INVALID_NAME: real name must be 2-60 characters' using errcode = '22023';
  end if;
  if v_msg is not null and char_length(v_msg) > 280 then
    raise exception 'INVALID_MESSAGE: message must be 280 characters or fewer' using errcode = '22023';
  end if;
  if not public.te_valid_email(v_email) then
    raise exception 'INVALID_EMAIL: that email address is not valid' using errcode = '22023';
  end if;
  if not exists (select 1 from public.te_countries where code = v_country and active) then
    raise exception 'INVALID_COUNTRY: choose a country from the list' using errcode = '22023';
  end if;
  v_ref := nullif(btrim(coalesce(p_ref, '')), '');
  if v_ref is not null and not exists (select 1 from public.te_entries where ref_code = v_ref and status = 'active') then
    v_ref := null;
  end if;

  insert into public.te_drafts (nickname, real_name, show_real_name, country, message, email, ref_in,
                                price_cents, currency, terms_version)
  values (v_nick, v_real, coalesce(p_show_real_name, false) and v_real is not null, v_country, v_msg, v_email, v_ref,
          (public.te_setting('price_cents'))::int, public.te_setting('currency') #>> '{}',
          coalesce(nullif(left(btrim(p_terms_version), 20), ''), 'unknown'))
  returning id, expires_at into v_id, v_exp;

  delete from public.te_drafts where status in ('draft','expired','cancelled','failed')
    and created_at < now() - interval '30 days';

  return jsonb_build_object('draft_id', v_id, 'expires_at', v_exp);
end $$;

create or replace function public.te_get_draft(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('draft_id', d.id, 'nickname', d.nickname, 'real_name', d.real_name,
           'show_real_name', d.show_real_name, 'country', d.country, 'message', d.message,
           'status', d.status, 'price_cents', d.price_cents, 'currency', d.currency,
           'expires_at', d.expires_at,
           'entry_number', (select entry_number from public.te_entries e where e.draft_id = d.id))
    from public.te_drafts d where d.id = p_id
$$;

create or replace function public.te_join_waitlist(p_email text, p_draft uuid default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_country text;
begin
  if not public.rl_allow('te_waitlist', 10, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts, try again later' using errcode = '54000';
  end if;
  if not public.te_valid_email(v_email) then
    raise exception 'INVALID_EMAIL: that email address is not valid' using errcode = '22023';
  end if;
  select country into v_country from public.te_drafts where id = p_draft;
  insert into public.te_waitlist (email, draft_id, country)
  values (v_email, case when v_country is not null then p_draft end, v_country)
  on conflict (email) do nothing;
  return jsonb_build_object('ok', true);   -- identical response either way
end $$;

-- After payment the buyer's success page reads its entry by Stripe session id.
-- The manage key is revealed exactly once, to whoever holds the session id
-- (only the buyer's browser is redirected with it).
create or replace function public.te_entry_by_session(p_session text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_d public.te_drafts; v_e public.te_entries; v_key text;
begin
  if not public.rl_allow('te_entry_by_session', 120, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many attempts' using errcode = '54000';
  end if;
  select * into v_d from public.te_drafts where stripe_session_id = p_session;
  if not found then return jsonb_build_object('status', 'unknown'); end if;
  select * into v_e from public.te_entries where draft_id = v_d.id for update;
  if not found then return jsonb_build_object('status', v_d.status); end if;
  if not v_e.manage_key_revealed and v_e.status = 'active' then
    v_key := encode(extensions.gen_random_bytes(24), 'hex');
    update public.te_entries set manage_key_hash = encode(extensions.digest(v_key, 'sha256'), 'hex'),
                                 manage_key_revealed = true
     where id = v_e.id;
  end if;
  return jsonb_build_object('status', case when v_e.status = 'active' then 'paid' else v_e.status end,
                            'entry', public.te_entry_json(v_e), 'ref_code', v_e.ref_code,
                            'manage_key', v_key);
end $$;

-- Referral click: deduplicated per visitor per 24h, self-clicks flagged,
-- bursts flagged, IP never stored (salted hash only).
create or replace function public.te_track_referral(p_ref text, p_ua text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_entry uuid; v_visitor text; v_valid boolean := true; v_reason text;
begin
  if not public.rl_allow('te_ref_click', 30, interval '1 hour') then return; end if;
  select id into v_entry from public.te_entries where ref_code = btrim(coalesce(p_ref, '')) and status = 'active';
  if v_entry is null then return; end if;
  v_visitor := encode(extensions.digest((public.te_setting('referral_salt') #>> '{}') || '|' ||
                public.client_ip() || '|' || left(coalesce(p_ua, ''), 200), 'sha256'), 'hex');
  if coalesce(p_ua, '') ~* '(bot|crawler|spider|preview|curl|wget|python|headless)' then
    v_valid := false; v_reason := 'bot_ua';
  elsif exists (select 1 from public.te_referral_clicks where entry_id = v_entry and visitor = v_visitor
                  and created_at > now() - interval '24 hours') then
    v_valid := false; v_reason := 'duplicate_24h';
  elsif (select count(*) from public.te_referral_clicks where visitor = v_visitor
          and created_at > now() - interval '1 hour') >= 10 then
    v_valid := false; v_reason := 'burst';
  end if;
  insert into public.te_referral_clicks (entry_id, visitor, valid, reason) values (v_entry, v_visitor, v_valid, v_reason);
  delete from public.te_referral_clicks where created_at < now() - interval '12 months';   -- retention
end $$;

create or replace function public.te_report_entry(p_entry bigint, p_reason text, p_details text default null, p_email text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.rl_allow('te_report', 10, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many reports, try again later' using errcode = '54000';
  end if;
  if p_reason not in ('offensive','hate','personal_data','impersonation','spam','illegal','other') then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  if p_email is not null and btrim(p_email) <> '' and not public.te_valid_email(lower(btrim(p_email))) then
    raise exception 'INVALID_EMAIL: that email address is not valid' using errcode = '22023';
  end if;
  insert into public.te_reports (entry_number, reason, details, email)
  values (p_entry, p_reason, left(public.clean_text(p_details), 1000), nullif(lower(btrim(coalesce(p_email,''))), ''));
  delete from public.te_reports where created_at < now() - interval '24 months' and status <> 'open';
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.te_privacy_request(p_email text, p_kind text, p_entry bigint default null, p_details text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.rl_allow('te_privacy', 5, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many requests, try again later' using errcode = '54000';
  end if;
  if not public.te_valid_email(lower(btrim(coalesce(p_email, '')))) then
    raise exception 'INVALID_EMAIL: that email address is not valid' using errcode = '22023';
  end if;
  if p_kind not in ('correction','hide_name','hide_message','removal','access','erasure','other') then
    raise exception 'INVALID_KIND' using errcode = '22023';
  end if;
  insert into public.te_privacy_requests (entry_number, email, kind, details)
  values (p_entry, lower(btrim(p_email)), p_kind, left(public.clean_text(p_details), 2000));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.te_contact(p_email text, p_topic text, p_body text, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.rl_allow('te_contact', 5, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many messages, try again later' using errcode = '54000';
  end if;
  if not public.te_valid_email(lower(btrim(coalesce(p_email, '')))) then
    raise exception 'INVALID_EMAIL: that email address is not valid' using errcode = '22023';
  end if;
  if p_topic not in ('general','support','payment','press','privacy') then
    raise exception 'INVALID_TOPIC' using errcode = '22023';
  end if;
  if char_length(coalesce(public.clean_text(p_body), '')) < 5 then
    raise exception 'INVALID_MESSAGE: please write a little more' using errcode = '22023';
  end if;
  insert into public.te_messages (name, email, topic, body)
  values (left(public.clean_text(p_name), 80), lower(btrim(p_email)), p_topic, left(public.clean_text(p_body), 4000));
  delete from public.te_messages where created_at < now() - interval '24 months';
  delete from public.te_privacy_requests where created_at < now() - interval '24 months' and status <> 'open';
  return jsonb_build_object('ok', true);
end $$;

-- ── Participant self-management (manage key) ─────────────────────────
create or replace function public.te_manage_get(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_e public.te_entries;
begin
  select * into v_e from public.te_entries
   where manage_key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  if not found then raise exception 'INVALID_KEY: that management link is not valid' using errcode = '28000'; end if;
  return jsonb_build_object(
    'entry', public.te_entry_json(v_e), 'status', v_e.status, 'real_name', v_e.real_name,
    'show_real_name', v_e.show_real_name, 'message', v_e.message, 'message_hidden', v_e.message_hidden,
    'public_referrals', v_e.public_referrals, 'ref_code', v_e.ref_code,
    'referral_clicks', (select count(*) from public.te_referral_clicks where entry_id = v_e.id and valid),
    'referral_flagged', (select count(*) from public.te_referral_clicks where entry_id = v_e.id and not valid),
    'referred_entries', (select count(*) from public.te_entries r where r.referred_by = v_e.id and r.status = 'active'));
end $$;

create or replace function public.te_manage_update(p_key text, p_show_real_name boolean, p_message_hidden boolean, p_public_referrals boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not public.rl_allow('te_manage', 30, interval '1 hour') then
    raise exception 'RATE_LIMIT: too many changes' using errcode = '54000';
  end if;
  update public.te_entries
     set show_real_name   = coalesce(p_show_real_name, show_real_name) and real_name is not null,
         message_hidden   = coalesce(p_message_hidden, message_hidden),
         public_referrals = coalesce(p_public_referrals, public_referrals)
   where manage_key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
   returning id into v_id;
  if v_id is null then raise exception 'INVALID_KEY: that management link is not valid' using errcode = '28000'; end if;
  insert into public.te_audit_log (actor, action, target, detail)
  values ('participant', 'manage_update', v_id::text,
          jsonb_build_object('show_real_name', p_show_real_name, 'message_hidden', p_message_hidden, 'public_referrals', p_public_referrals));
  return public.te_manage_get(p_key);
end $$;

-- ════════════════════════════════════════════════════════════════════
--  SERVICE ROLE ONLY (Vercel functions holding the secret key)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.te_service_checkout_draft(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_d public.te_drafts;
begin
  if (public.te_setting('payments_enabled'))::boolean is not true then
    raise exception 'PAYMENTS_DISABLED' using errcode = '55000';
  end if;
  -- EU consumer law: the trader's identity and address must be shown before a contract.
  if coalesce(public.te_setting('operator_name') #>> '{}', '') = ''
     or coalesce(public.te_setting('operator_address') #>> '{}', '') = '' then
    raise exception 'PAYMENTS_DISABLED: operator details missing' using errcode = '55000';
  end if;
  select * into v_d from public.te_drafts where id = p_id for update;
  if not found then raise exception 'DRAFT_NOT_FOUND' using errcode = '22023'; end if;
  if v_d.status = 'paid' then raise exception 'ALREADY_PAID' using errcode = '22023'; end if;
  if v_d.expires_at < now() then
    update public.te_drafts set status = 'expired' where id = p_id;
    raise exception 'DRAFT_EXPIRED' using errcode = '22023';
  end if;
  if v_d.checkout_attempts >= 10 then raise exception 'TOO_MANY_ATTEMPTS' using errcode = '54000'; end if;
  -- the price is the one shown when the draft was made; a changed setting forces a new draft
  if v_d.price_cents <> (public.te_setting('price_cents'))::int or v_d.currency <> public.te_setting('currency') #>> '{}' then
    raise exception 'PRICE_CHANGED' using errcode = '22023';
  end if;
  update public.te_drafts set checkout_attempts = checkout_attempts + 1 where id = p_id
  returning * into v_d;
  return jsonb_build_object('draft_id', v_d.id, 'email', v_d.email, 'nickname', v_d.nickname,
    'price_cents', v_d.price_cents, 'currency', v_d.currency, 'attempt', v_d.checkout_attempts);
end $$;

create or replace function public.te_service_attach_session(p_id uuid, p_session text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.te_drafts set stripe_session_id = p_session, status = 'checkout'
   where id = p_id and status in ('draft','checkout','cancelled','failed','expired')
$$;

-- The ONLY way a paid entry is created. Idempotent on the Stripe event id
-- AND on the session (a second event for the same session returns the
-- existing entry). Amount and currency must match what the draft quoted.
create or replace function public.te_finalize_payment(
  p_event_id text, p_session text, p_payment_intent text, p_amount integer, p_currency text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_d public.te_drafts; v_e public.te_entries; v_num bigint; v_ref uuid; v_inserted int;
begin
  insert into public.te_payment_events (event_id, type, session_id)
  values (p_event_id, 'checkout.session.completed', p_session)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;

  select * into v_d from public.te_drafts where stripe_session_id = p_session for update;
  if not found then
    update public.te_payment_events set result = 'unknown_session' where event_id = p_event_id;
    return jsonb_build_object('result', 'unknown_session');
  end if;

  select * into v_e from public.te_entries where draft_id = v_d.id;
  if found then
    update public.te_payment_events set result = 'duplicate' where event_id = p_event_id and v_inserted = 1;
    return jsonb_build_object('result', 'duplicate', 'entry_number', v_e.entry_number);
  end if;

  if p_amount is distinct from v_d.price_cents or lower(p_currency) is distinct from lower(v_d.currency) then
    update public.te_payment_events set result = 'amount_mismatch' where event_id = p_event_id;
    perform public.te_audit('payment_amount_mismatch', v_d.id::text,
      jsonb_build_object('session', p_session, 'amount', p_amount, 'currency', p_currency));
    return jsonb_build_object('result', 'amount_mismatch');
  end if;

  -- referral attribution: valid code, not the buyer's own entry (same email)
  if v_d.ref_in is not null then
    select id into v_ref from public.te_entries
     where ref_code = v_d.ref_in and status = 'active' and lower(email) <> lower(v_d.email);
  end if;

  update public.te_counter set last = last + 1 where id returning last into v_num;

  insert into public.te_entries (entry_number, draft_id, nickname, real_name, show_real_name, country,
    message, email, ref_code, referred_by, stripe_session_id, stripe_payment_intent, amount_cents, currency)
  values (v_num, v_d.id, v_d.nickname, v_d.real_name, v_d.show_real_name, v_d.country, v_d.message,
    v_d.email, encode(extensions.gen_random_bytes(5), 'hex'), v_ref, p_session, p_payment_intent,
    p_amount, lower(p_currency))
  returning * into v_e;

  update public.te_drafts set status = 'paid' where id = v_d.id;
  update public.te_payment_events set result = 'created:' || v_num where event_id = p_event_id;
  insert into public.te_audit_log (actor, action, target, detail)
  values ('stripe', 'entry_created', v_num::text, jsonb_build_object('session', p_session, 'event', p_event_id));
  return jsonb_build_object('result', 'created', 'entry_number', v_num);
end $$;

create or replace function public.te_mark_session(p_event_id text, p_session text, p_status text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_status not in ('expired','failed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  insert into public.te_payment_events (event_id, type, session_id, result)
  values (p_event_id, 'session_' || p_status, p_session, p_status) on conflict (event_id) do nothing;
  update public.te_drafts set status = p_status where stripe_session_id = p_session and status <> 'paid';
  return jsonb_build_object('result', 'ok');
end $$;

-- Refund: entry leaves the public record; its number is retired, never reused.
create or replace function public.te_record_refund(p_event_id text, p_payment_intent text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_num bigint;
begin
  insert into public.te_payment_events (event_id, type, result)
  values (p_event_id, 'charge.refunded', 'refund') on conflict (event_id) do nothing;
  update public.te_entries set status = 'refunded', refunded_at = coalesce(refunded_at, now())
   where stripe_payment_intent = p_payment_intent and status = 'active'
   returning entry_number into v_num;
  if v_num is not null then
    insert into public.te_audit_log (actor, action, target, detail)
    values ('stripe', 'entry_refunded', v_num::text, jsonb_build_object('event', p_event_id));
  end if;
  return jsonb_build_object('result', case when v_num is null then 'no_active_entry' else 'refunded' end, 'entry_number', v_num);
end $$;

create or replace function public.te_sitemap() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'entries', (select coalesce(jsonb_agg(jsonb_build_object('n', entry_number, 'at', updated_at) order by entry_number), '[]'::jsonb)
                  from public.te_entries where status = 'active' and moderation = 'approved'),
    'countries', (select coalesce(jsonb_agg(distinct country), '[]'::jsonb) from public.te_entries where status = 'active'),
    'journal', (select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'at', updated_at)), '[]'::jsonb)
                  from public.te_journal where status = 'published' or (status = 'scheduled' and publish_at <= now())))
$$;

-- ════════════════════════════════════════════════════════════════════
--  ADMIN (server-side authorisation + audit on every write)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.te_admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  return jsonb_build_object(
    'entries_active',   (select count(*) from public.te_entries where status = 'active'),
    'entries_pending_moderation', (select count(*) from public.te_entries where status = 'active' and moderation = 'pending'),
    'entries_refunded', (select count(*) from public.te_entries where status = 'refunded'),
    'revenue_cents',    (select coalesce(sum(amount_cents), 0) from public.te_entries where status = 'active'),
    'drafts_7d',        (select count(*) from public.te_drafts where created_at > now() - interval '7 days'),
    'checkouts_7d',     (select count(*) from public.te_drafts where stripe_session_id is not null and created_at > now() - interval '7 days'),
    'waitlist',         (select count(*) from public.te_waitlist),
    'open_reports',     (select count(*) from public.te_reports where status = 'open'),
    'open_privacy',     (select count(*) from public.te_privacy_requests where status = 'open'),
    'open_messages',    (select count(*) from public.te_messages where status = 'open'),
    'ref_clicks_valid', (select count(*) from public.te_referral_clicks where valid),
    'ref_clicks_flagged', (select count(*) from public.te_referral_clicks where not valid),
    'settings',         (select jsonb_object_agg(key, value) from public.te_settings where key <> 'referral_salt'));
end $$;

create or replace function public.te_admin_entries(p_q text default null, p_status text default null, p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_number desc), '[]'::jsonb) from (
    select entry_number, nickname, real_name, show_real_name, country, message, message_hidden, email,
           status, moderation, public_referrals, amount_cents, currency, paid_at, refunded_at, stripe_payment_intent
      from public.te_entries
     where (p_status is null or p_status = '' or moderation = p_status or status = p_status)
       and (p_q is null or p_q = '' or lower(nickname) like '%' || lower(p_q) || '%' or lower(email) = lower(p_q)
            or entry_number::text = p_q)
     order by entry_number desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x);
end $$;

create or replace function public.te_admin_moderate(p_entry bigint, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  if p_action = 'approve' then update public.te_entries set moderation = 'approved' where entry_number = p_entry;
  elsif p_action = 'hide' then update public.te_entries set moderation = 'hidden' where entry_number = p_entry;
  elsif p_action = 'pending' then update public.te_entries set moderation = 'pending' where entry_number = p_entry;
  elsif p_action = 'hide_message' then update public.te_entries set message_hidden = true where entry_number = p_entry;
  elsif p_action = 'show_message' then update public.te_entries set message_hidden = false where entry_number = p_entry;
  elsif p_action = 'hide_real_name' then update public.te_entries set show_real_name = false where entry_number = p_entry;
  elsif p_action = 'remove' then update public.te_entries set status = 'removed' where entry_number = p_entry;
  elsif p_action = 'erase_personal' then
    update public.te_entries set real_name = null, show_real_name = false, message = null,
           nickname = 'Entry #' || entry_number, status = 'removed' where entry_number = p_entry;
  else raise exception 'INVALID_ACTION' using errcode = '22023';
  end if;
  perform public.te_audit('moderate:' || p_action, p_entry::text, jsonb_build_object('note', p_note));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.te_admin_queue() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  return jsonb_build_object(
    'reports',  (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
                   from (select * from public.te_reports order by created_at desc limit 200) r),
    'privacy',  (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
                   from (select * from public.te_privacy_requests order by created_at desc limit 200) r),
    'messages', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
                   from (select * from public.te_messages order by created_at desc limit 200) r));
end $$;

create or replace function public.te_admin_resolve(p_kind text, p_id bigint, p_status text, p_resolution text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  if p_kind = 'report' then
    update public.te_reports set status = p_status, resolution = p_resolution, resolved_at = now() where id = p_id;
  elsif p_kind = 'privacy' then
    update public.te_privacy_requests set status = p_status, resolution = p_resolution, resolved_at = now() where id = p_id;
  elsif p_kind = 'message' then
    update public.te_messages set status = p_status where id = p_id;
  else raise exception 'INVALID_KIND' using errcode = '22023';
  end if;
  perform public.te_audit('resolve:' || p_kind, p_id::text, jsonb_build_object('status', p_status, 'resolution', p_resolution));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.te_admin_journal_all() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  return jsonb_build_object(
    'journal',    (select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at desc), '[]'::jsonb) from public.te_journal j),
    'milestones', (select coalesce(jsonb_agg(to_jsonb(m) order by m.occurred_on desc), '[]'::jsonb) from public.te_milestones m),
    'metrics',    (select coalesce(jsonb_agg(to_jsonb(m) order by m.as_of desc), '[]'::jsonb) from public.te_metrics m));
end $$;

create or replace function public.te_admin_journal_save(
  p_id uuid, p_slug text, p_title text, p_excerpt text, p_body text, p_cover_url text,
  p_categories text[], p_status text, p_publish_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.te_require_admin();
  if p_id is null then
    insert into public.te_journal (slug, title, excerpt, body, cover_url, categories, status, publish_at)
    values (p_slug, p_title, nullif(p_excerpt, ''), coalesce(p_body, ''), nullif(p_cover_url, ''),
            coalesce(p_categories, '{}'), p_status,
            coalesce(p_publish_at, case when p_status = 'published' then now() end))
    returning id into v_id;
  else
    update public.te_journal set slug = p_slug, title = p_title, excerpt = nullif(p_excerpt, ''),
           body = coalesce(p_body, ''), cover_url = nullif(p_cover_url, ''), categories = coalesce(p_categories, '{}'),
           status = p_status, publish_at = coalesce(p_publish_at, publish_at, case when p_status = 'published' then now() end),
           updated_at = now()
     where id = p_id returning id into v_id;
  end if;
  perform public.te_audit('journal_save', v_id::text, jsonb_build_object('slug', p_slug, 'status', p_status));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.te_admin_journal_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  delete from public.te_journal where id = p_id;
  perform public.te_audit('journal_delete', p_id::text, null);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.te_admin_milestone_save(
  p_id uuid, p_occurred_on date, p_title text, p_detail text, p_kind text, p_verified boolean,
  p_source_url text, p_journal_slug text, p_published boolean
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.te_require_admin();
  if p_id is null then
    insert into public.te_milestones (occurred_on, title, detail, kind, verified, source_url, journal_slug, published)
    values (p_occurred_on, p_title, nullif(p_detail, ''), p_kind, coalesce(p_verified, false), nullif(p_source_url, ''),
            nullif(p_journal_slug, ''), coalesce(p_published, false)) returning id into v_id;
  else
    update public.te_milestones set occurred_on = p_occurred_on, title = p_title, detail = nullif(p_detail, ''),
           kind = p_kind, verified = coalesce(p_verified, false), source_url = nullif(p_source_url, ''),
           journal_slug = nullif(p_journal_slug, ''), published = coalesce(p_published, false)
     where id = p_id returning id into v_id;
  end if;
  perform public.te_audit('milestone_save', v_id::text, jsonb_build_object('title', p_title, 'published', p_published));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.te_admin_metric_save(
  p_id uuid, p_kind text, p_label text, p_amount numeric, p_currency text, p_as_of date,
  p_source text, p_methodology text, p_published boolean
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.te_require_admin();
  if p_id is null then
    insert into public.te_metrics (kind, label, amount, currency, as_of, source, methodology, published)
    values (p_kind, p_label, p_amount, upper(p_currency), p_as_of, p_source, p_methodology, coalesce(p_published, false))
    returning id into v_id;
  else
    update public.te_metrics set kind = p_kind, label = p_label, amount = p_amount, currency = upper(p_currency),
           as_of = p_as_of, source = p_source, methodology = p_methodology, published = coalesce(p_published, false)
     where id = p_id returning id into v_id;
  end if;
  perform public.te_audit('metric_save', v_id::text,
    jsonb_build_object('kind', p_kind, 'amount', p_amount, 'as_of', p_as_of, 'published', p_published));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.te_admin_delete(p_kind text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  if p_kind = 'milestone' then delete from public.te_milestones where id = p_id;
  elsif p_kind = 'metric' then delete from public.te_metrics where id = p_id;
  else raise exception 'INVALID_KIND' using errcode = '22023';
  end if;
  perform public.te_audit('delete:' || p_kind, p_id::text, null);
  return jsonb_build_object('ok', true);
end $$;

-- Settings the dashboard may change. payments_enabled here is necessary but
-- not sufficient: the server also requires TE_PAYMENTS_LIVE=true and Stripe keys.
create or replace function public.te_admin_set_setting(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old jsonb;
begin
  perform public.te_require_admin();
  p_value := coalesce(p_value, 'null'::jsonb);   -- PostgREST sends JSON null as SQL NULL
  if p_key not in ('payments_enabled','price_cents','currency','target_eur','challenge_started_on','waitlist_enabled',
                   'operator_name','operator_address','operator_email') then
    raise exception 'INVALID_SETTING' using errcode = '22023';
  end if;
  if p_key in ('payments_enabled','waitlist_enabled') and jsonb_typeof(p_value) <> 'boolean' then
    raise exception 'INVALID_VALUE: boolean required' using errcode = '22023'; end if;
  if p_key = 'price_cents' and (jsonb_typeof(p_value) <> 'number' or (p_value)::numeric < 100 or (p_value)::numeric > 100000) then
    raise exception 'INVALID_VALUE: price must be 100-100000 cents' using errcode = '22023'; end if;
  if p_key = 'currency' and (p_value #>> '{}') !~ '^[a-z]{3}$' then
    raise exception 'INVALID_VALUE: lower-case ISO currency' using errcode = '22023'; end if;
  if p_key = 'challenge_started_on' and p_value <> 'null'::jsonb and (p_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'INVALID_VALUE: YYYY-MM-DD or null' using errcode = '22023'; end if;
  if p_key in ('operator_name','operator_address','operator_email') and p_value <> 'null'::jsonb
     and (jsonb_typeof(p_value) <> 'string' or char_length(p_value #>> '{}') > 300) then
    raise exception 'INVALID_VALUE: text up to 300 characters or null' using errcode = '22023'; end if;
  if p_key = 'payments_enabled' and p_value = 'true'::jsonb and (
       coalesce(public.te_setting('operator_name') #>> '{}', '') = ''
       or coalesce(public.te_setting('operator_address') #>> '{}', '') = '') then
    raise exception 'OPERATOR_DETAILS_MISSING: publish operator name and address first' using errcode = '22023'; end if;
  select value into v_old from public.te_settings where key = p_key;
  update public.te_settings set value = p_value, updated_at = now() where key = p_key;
  perform public.te_audit('setting', p_key, jsonb_build_object('from', v_old, 'to', p_value));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.te_admin_country_save(p_code text, p_population bigint, p_year int, p_source text, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  update public.te_countries set population = p_population, population_year = p_year,
         population_source = nullif(p_source, ''), active = coalesce(p_active, true)
   where code = upper(p_code);
  perform public.te_audit('country_save', upper(p_code), jsonb_build_object('population', p_population, 'year', p_year, 'source', p_source));
  return jsonb_build_object('ok', true);
end $$;

-- Export of the PUBLIC archive (no emails, no payment ids) + aggregates.
create or replace function public.te_admin_export() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  perform public.te_audit('export', null, null);
  return jsonb_build_object(
    'exported_at', now(),
    'entries', (select coalesce(jsonb_agg(public.te_entry_json(e) order by e.entry_number), '[]'::jsonb)
                  from public.te_entries e where e.status = 'active'),
    'countries', public.te_country_stats());
end $$;

create or replace function public.te_admin_audit(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  return (select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc), '[]'::jsonb)
            from (select * from public.te_audit_log order by id desc limit least(greatest(p_limit, 1), 500)) a);
end $$;

-- ════════════════════════════════════════════════════════════════════
--  GRANTS
-- ════════════════════════════════════════════════════════════════════
do $g$
declare f text;
begin
  -- revoke everything on te_* functions first
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'te\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- public (anon + signed-in)
  for f in select unnest(array[
      'te_public_settings()','te_stats()','te_record(text,text,text,integer,integer)','te_entry(bigint)',
      'te_country_stats()','te_countries_list()','te_referral_board(integer)','te_journal_list(integer)',
      'te_journal_get(text)','te_milestones_list()','te_metrics_list()','te_sitemap()',
      'te_create_draft(text,text,text,text,boolean,text,text,boolean,text)','te_get_draft(uuid)',
      'te_join_waitlist(text,uuid)','te_entry_by_session(text)','te_track_referral(text,text)',
      'te_report_entry(bigint,text,text,text)','te_privacy_request(text,text,bigint,text)',
      'te_contact(text,text,text,text)','te_manage_get(text)','te_manage_update(text,boolean,boolean,boolean)']) loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  -- signed-in only (admin check inside)
  for f in select unnest(array[
      'te_is_admin()','te_admin_overview()','te_admin_entries(text,text,integer,integer)',
      'te_admin_moderate(bigint,text,text)','te_admin_queue()','te_admin_resolve(text,bigint,text,text)',
      'te_admin_journal_all()',
      'te_admin_journal_save(uuid,text,text,text,text,text,text[],text,timestamptz)','te_admin_journal_delete(uuid)',
      'te_admin_milestone_save(uuid,date,text,text,text,boolean,text,text,boolean)',
      'te_admin_metric_save(uuid,text,text,numeric,text,date,text,text,boolean)','te_admin_delete(text,uuid)',
      'te_admin_set_setting(text,jsonb)','te_admin_country_save(text,bigint,integer,text,boolean)',
      'te_admin_export()','te_admin_audit(integer)']) loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- service role only
  for f in select unnest(array[
      'te_service_checkout_draft(uuid)','te_service_attach_session(uuid,text)',
      'te_finalize_payment(text,text,text,integer,text)','te_mark_session(text,text,text)',
      'te_record_refund(text,text)']) loop
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $g$;
