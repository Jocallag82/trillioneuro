-- RateMe.ie — initial schema. Everything lives in schema "rateme" so the app can share a
-- Postgres instance without touching any other application's tables.
create schema if not exists rateme;
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists citext with schema extensions;

set search_path = rateme, extensions, public;

-- Immutable wrapper so unaccent can be used in indexes / generated columns.
create or replace function rateme.norm(t text) returns text
language sql immutable parallel safe as $$
  select lower(regexp_replace(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')), '[^a-zA-Z0-9]+', ' ', 'g'))
$$;

-- ── Reference data ────────────────────────────────────────────────────────────
create table counties (
  id smallserial primary key,
  slug text not null unique,
  name text not null unique,
  province text not null check (province in ('Leinster','Munster','Connacht','Ulster')),
  country_code char(2) not null default 'IE'
);

create table localities (
  id serial primary key,
  county_id smallint not null references counties(id),
  name text not null,
  slug text not null,
  unique (county_id, slug)
);
create index localities_name_trgm on localities using gin (rateme.norm(name) gin_trgm_ops);

create table categories (
  id serial primary key,
  parent_id int references categories(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  sort_order int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index categories_parent on categories(parent_id);

-- ── Accounts ──────────────────────────────────────────────────────────────────
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text not null,
  display_name text not null check (length(display_name) between 1 and 80),
  role text not null default 'user' check (role in ('user','moderator','admin')),
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  email_verified_at timestamptz,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id text primary key,                 -- sha256 of the cookie token; the token itself is never stored
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text
);
create index sessions_user on sessions(user_id);

create table email_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  purpose text not null check (purpose in ('verify_email','reset_password','business_email','review_confirm','review_manage')),
  user_id uuid references users(id) on delete cascade,
  ref_id uuid,                         -- review id / verification request id
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Businesses ────────────────────────────────────────────────────────────────
create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 2 and 120),
  category_id int not null references categories(id),
  county_id smallint not null references counties(id),
  locality_id int references localities(id),
  address_line1 text,
  address_line2 text,
  eircode text check (eircode is null or eircode ~ '^[A-Z][0-9][0-9W] ?[0-9AC-FHKNPRTV-Y]{4}$'),
  show_address boolean not null default false,   -- sole traders working from home: hidden by default
  phone text,
  public_email text,
  website text,
  website_domain text,
  socials jsonb not null default '{}'::jsonb,
  description text check (description is null or length(description) <= 1500),
  logo_id uuid,
  cro_number text,
  country_code char(2) not null default 'IE',
  status text not null default 'pending' check (status in ('pending','published','suspended','removed')),
  source text not null check (source in ('owner','community','admin')),
  created_by uuid references users(id) on delete set null,
  ownership_verified_at timestamptz,
  -- Aggregates: maintained ONLY by the reviews trigger from published reviews.
  rating_count int not null default 0,
  rating_sum int not null default 0,
  rating_avg numeric(3,2),
  rating_dist int[] not null default '{0,0,0,0,0}',
  last_review_at timestamptz,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index businesses_name_trgm on businesses using gin (rateme.norm(name) gin_trgm_ops);
create index businesses_cat on businesses(category_id) where status = 'published';
create index businesses_county on businesses(county_id) where status = 'published';
create index businesses_locality on businesses(locality_id) where status = 'published';
create index businesses_eircode on businesses(left(eircode, 3)) where status = 'published';
-- Duplicate guard: same normalised name in the same county/locality cannot exist twice.
create unique index businesses_dupe_guard on businesses (rateme.norm(name), county_id, coalesce(locality_id, 0))
  where status <> 'removed';

create table business_slug_history (
  slug text primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table logos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  mime text not null check (mime in ('image/png','image/jpeg','image/webp')),
  bytes bytea not null check (octet_length(bytes) <= 307200),
  created_at timestamptz not null default now()
);
alter table businesses add constraint businesses_logo_fk foreign key (logo_id) references logos(id) on delete set null;

-- Many authorised users per business; roles are extensible.
create table business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager')),
  status text not null default 'pending' check (status in ('pending','verified','rejected','revoked')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (business_id, user_id)
);
create index business_members_user on business_members(user_id);

create table verification_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  member_id uuid not null references business_members(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  method text not null check (method in ('email_domain','dns_txt','website_file','manual')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  target text,                       -- email address or domain being checked
  challenge text,                    -- public token for DNS / file checks (not a secret)
  evidence text,                     -- manual: what the applicant told us
  contact_phone text,
  decided_by uuid references users(id),
  decision_notes text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index verification_requests_status on verification_requests(status, created_at);

-- ── Membership & billing ─────────────────────────────────────────────────────
create table plans (
  id serial primary key,
  code text not null unique,
  name text not null,
  description text,
  amount_cents int not null check (amount_cents > 0),
  currency char(3) not null default 'eur',
  billing_interval text not null default 'year' check (billing_interval in ('year','month')),
  is_founding boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table checkout_sessions (
  stripe_session_id text primary key,
  business_id uuid not null references businesses(id),
  user_id uuid not null references users(id),
  plan_id int not null references plans(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  plan_id int references plans(id),
  purchaser_id uuid references users(id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text not null unique,
  status text not null,              -- Stripe's status, verbatim
  amount_cents int,
  currency char(3),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  payment_failed_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  last_event_created bigint not null default 0,   -- Stripe event.created of the last applied update
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_business on subscriptions(business_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id),
  business_id uuid references businesses(id),
  stripe_invoice_id text not null unique,
  stripe_charge_id text,
  amount_paid int not null default 0,
  currency char(3) not null default 'eur',
  status text not null,
  hosted_invoice_url text,
  invoice_pdf text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);

create table stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

-- ── QR codes ─────────────────────────────────────────────────────────────────
create table qr_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9]{8}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index qr_codes_one_active on qr_codes(business_id) where revoked_at is null;

-- ── Reviews ──────────────────────────────────────────────────────────────────
create table reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or length(title) <= 120),
  body text check (body is null or length(body) <= 4000),
  experience_type text,
  experience_month date not null,
  reviewer_name text not null check (length(reviewer_name) between 1 and 60),
  reviewer_email citext not null,                    -- never published
  reviewer_email_hash text not null,
  declaration_at timestamptz not null,               -- "this is my own genuine experience"
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation','published','held','rejected','removed','withdrawn')),
  hold_reasons text[] not null default '{}',
  source text not null default 'web' check (source in ('web','qr')),
  ip_hash text,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create index reviews_business_pub on reviews(business_id, published_at desc) where status = 'published';
create index reviews_status on reviews(status, created_at);
create index reviews_ip on reviews(ip_hash, created_at);
-- One live review per person per business.
create unique index reviews_one_per_reviewer on reviews(business_id, reviewer_email_hash)
  where status in ('pending_confirmation','published','held');

create table review_responses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references reviews(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  author_user_id uuid references users(id) on delete set null,
  body text not null check (length(body) between 2 and 2000),
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('review','response','business_info')),
  review_id uuid references reviews(id) on delete cascade,
  response_id uuid references review_responses(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  reason text not null,
  details text check (details is null or length(details) <= 2000),
  reporter_email citext,
  reporter_user_id uuid references users(id) on delete set null,
  ip_hash text,
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolution_notes text,
  resolved_by uuid references users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status on reports(status, created_at);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  raised_by uuid not null references users(id),
  reason text not null,
  allegation text not null check (length(allegation) between 10 and 3000),  -- the business's claim, not a finding
  status text not null default 'open' check (status in ('open','upheld','rejected')),
  finding text,                                                             -- moderator's finding
  decided_by uuid references users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index disputes_one_open on disputes(review_id) where status = 'open';

create table appeals (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  appellant text not null check (appellant in ('reviewer','business')),
  user_id uuid references users(id),
  body text not null check (length(body) between 10 and 3000),
  status text not null default 'open' check (status in ('open','granted','denied')),
  decision_notes text,
  decided_by uuid references users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index appeals_one_open on appeals(review_id, appellant) where status = 'open';

create table moderation_actions (
  id bigserial primary key,
  review_id uuid references reviews(id) on delete cascade,
  response_id uuid references review_responses(id) on delete cascade,
  actor_user_id uuid references users(id),       -- null = automated system check
  action text not null,
  from_status text,
  to_status text,
  reason text,
  notes text,
  created_at timestamptz not null default now()
);
create index moderation_actions_review on moderation_actions(review_id, created_at);

create table audit_events (
  id bigserial primary key,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created on audit_events(created_at desc);

-- ── Operations ───────────────────────────────────────────────────────────────
create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

create table business_daily_stats (
  business_id uuid not null references businesses(id) on delete cascade,
  day date not null,
  profile_views int not null default 0,
  qr_scans int not null default 0,
  review_starts int not null default 0,
  primary key (business_id, day)
);

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email citext not null,
  subject text not null,
  body_text text not null,
  template text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_id text,
  error text
);
create index email_outbox_to on email_outbox(to_email, created_at desc);

create table data_requests (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  kind text not null check (kind in ('access','erasure','rectification','objection','legal_removal','complaint')),
  details text not null check (length(details) <= 4000),
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  notes text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- ── Rating aggregates: always recomputed from published reviews ───────────────
create or replace function rateme.refresh_business_rating(b uuid) returns void
language plpgsql as $$
begin
  update rateme.businesses bz set
    rating_count = s.c,
    rating_sum = s.total,
    rating_avg = case when s.c > 0 then round(s.total::numeric / s.c, 2) end,
    rating_dist = array[s.r1, s.r2, s.r3, s.r4, s.r5],
    last_review_at = s.last_at
  from (
    select count(*)::int c, coalesce(sum(rating), 0)::int total,
      count(*) filter (where rating = 1)::int r1, count(*) filter (where rating = 2)::int r2,
      count(*) filter (where rating = 3)::int r3, count(*) filter (where rating = 4)::int r4,
      count(*) filter (where rating = 5)::int r5, max(published_at) last_at
    from rateme.reviews where business_id = b and status = 'published'
  ) s
  where bz.id = b;
end $$;

create or replace function rateme.reviews_after_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform rateme.refresh_business_rating(old.business_id);
    return old;
  end if;
  if tg_op = 'INSERT' or old.status is distinct from new.status or old.rating is distinct from new.rating then
    perform rateme.refresh_business_rating(new.business_id);
  end if;
  return new;
end $$;

create trigger reviews_rating_sync after insert or update or delete on reviews
  for each row execute function rateme.reviews_after_change();
