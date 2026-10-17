-- Hands-off moderation: disputes and repeated reports are resolved automatically by asking the
-- reviewer to reconfirm. No moderator decision is required anywhere in the review lifecycle.
set search_path = rateme, extensions, public;

alter table disputes alter column raised_by drop not null;
alter table disputes add column if not exists source text not null default 'business' check (source in ('business','reports'));
alter table disputes add column if not exists deadline_at timestamptz;
alter table disputes add column if not exists reconfirmed_at timestamptz;
create index if not exists disputes_deadline on disputes(deadline_at) where status = 'open';

alter table email_tokens drop constraint if exists email_tokens_purpose_check;
alter table email_tokens add constraint email_tokens_purpose_check
  check (purpose in ('verify_email','reset_password','business_email','review_confirm','review_manage','review_reconfirm'));

insert into settings (key, value) values
 ('disputes', '{"reconfirm_days": 14, "max_per_business_per_30_days": 5, "reports_to_trigger": 3}'::jsonb)
on conflict (key) do nothing;
