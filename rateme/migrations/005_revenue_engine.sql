-- Revenue engine: notifications, suppression, AI usage, outreach, partners, attribution, listing provenance.
-- Additive only. Every outbound-email switch and the AI feature start DISABLED.
set search_path = rateme, extensions, public;

-- ── Email suppression & preferences ──────────────────────────────────────────
create table if not exists email_suppressions (
  email citext primary key,
  reason text not null check (reason in ('unsubscribed','bounced','complaint','do_not_contact','admin')),
  scope text not null default 'non_essential' check (scope in ('non_essential','all')),
  source text,
  created_at timestamptz not null default now()
);
alter table users add column if not exists digest_opt_out boolean not null default false;
alter table users add column if not exists ref_code text;

-- ── Notification log: one row per intended message, idempotent by dedupe_key ─
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('claim_invite','weekly_digest','renewal_30','renewal_7','kit_nudge')),
  dedupe_key text not null unique,
  business_id uuid references businesses(id) on delete cascade,
  review_id uuid references reviews(id) on delete set null,
  recipient citext,
  recipient_class text check (recipient_class in ('account_holder','business_domain','generic_mailbox','unknown')),
  status text not null default 'pending' check (status in ('pending','sent','outbox','suppressed','failed')),
  reason text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists notifications_pending on notifications(status, created_at) where status in ('pending','failed');
create index if not exists notifications_business on notifications(business_id, created_at desc);

create table if not exists job_runs (
  id bigserial primary key,
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  result jsonb,
  error text
);
create index if not exists job_runs_job on job_runs(job, started_at desc);

-- ── AI usage (cost tracking & limits) ────────────────────────────────────────
create table if not exists ai_usage (
  id bigserial primary key,
  feature text not null check (feature in ('reply_draft')),
  business_id uuid references businesses(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  review_id uuid references reviews(id) on delete set null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_micro_usd int not null default 0,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_business on ai_usage(business_id, created_at desc);

-- ── Outreach (founder-led sales) ─────────────────────────────────────────────
create table if not exists outreach_campaigns (
  id serial primary key,
  name text not null unique check (length(name) between 2 and 80),
  channel text not null default 'in_person' check (channel in ('in_person','phone','post','partner','event','other')),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists outreach_prospects (
  business_id uuid primary key references businesses(id) on delete cascade,
  status text not null default 'not_contacted' check (status in
    ('not_contacted','contacted','interested','claim_started','claimed_free','paid','not_interested','do_not_contact')),
  campaign_id int references outreach_campaigns(id) on delete set null,
  contact_name text check (contact_name is null or length(contact_name) <= 120),
  contact_phone text check (contact_phone is null or length(contact_phone) <= 40),
  notes text check (notes is null or length(notes) <= 4000),
  last_contact_at timestamptz,
  next_action text check (next_action is null or length(next_action) <= 200),
  next_action_at date,
  claim_token text unique,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists outreach_status on outreach_prospects(status);

-- ── Partners & attribution ───────────────────────────────────────────────────
create table if not exists partners (
  id serial primary key,
  code text not null unique check (code ~ '^[A-Z0-9]{4,16}$'),
  name text not null check (length(name) between 2 and 120),
  kind text not null check (kind in ('accountant','bookkeeper','adviser','chamber','association','other')),
  contact_email citext,
  user_id uuid references users(id) on delete set null,
  reward jsonb not null default '{"type":"none"}'::jsonb,   -- e.g. {"type":"percent_first_payment","value":20}
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- First-touch attribution, one per business. Never overwritten.
create table if not exists business_attribution (
  business_id uuid primary key references businesses(id) on delete cascade,
  source text not null check (source in ('partner','campaign')),
  partner_id int references partners(id) on delete set null,
  campaign_id int references outreach_campaigns(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── Listing provenance & data quality ────────────────────────────────────────
alter table businesses add column if not exists data_source text;          -- e.g. "business website", "owner", "CRO"
alter table businesses add column if not exists data_source_url text;
alter table businesses add column if not exists last_verified_at timestamptz;

-- ── Settings (all OFF until approved) ────────────────────────────────────────
insert into settings (key, value) values
 ('notifications', '{"claim_invite_enabled": false, "digest_enabled": false, "renewal_enabled": false, "kit_nudge_enabled": false, "max_per_run": 200}'::jsonb),
 ('ai', '{"reply_drafts_enabled": false, "drafts_per_business_per_month": 40, "monthly_budget_usd": 10}'::jsonb)
on conflict (key) do nothing;

-- Job lease: prevents overlapping scheduled runs (works with pooled connections).
create table if not exists job_locks (
  job text primary key,
  locked_until timestamptz not null
);

-- Outreach claim token carried through sign-up (first-party, no cookie).
alter table users add column if not exists signup_claim_token text;
