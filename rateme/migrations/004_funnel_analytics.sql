-- Honest, deduplicated activity counts. Additive only: no existing data is changed.
set search_path = rateme, extensions, public;

-- One row per (visitor fingerprint, business, event, Dublin day). The fingerprint is an HMAC of
-- IP + user agent + day keyed with APP_SECRET, so it cannot be reversed or linked across days.
-- Rows older than 2 days are deleted by the daily maintenance job.
create table if not exists stat_dedupe (
  key text primary key,
  created_at timestamptz not null default now()
);
create index if not exists stat_dedupe_created on stat_dedupe(created_at);

-- QR-kit downloads, so owners (and we) can see whether material was actually taken.
alter table business_daily_stats add column if not exists kit_downloads int not null default 0;
