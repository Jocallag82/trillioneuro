-- Fair disputes. Reviewer silence is no longer treated as proof a review is fraudulent.
--   open       → waiting for the reviewer to respond (review stays published)
--   escalated  → a moderator must decide (no response, contested evidence, or a policy allegation)
--   upheld / rejected → moderator (or legacy automatic) decision, documented in `finding`
--   withdrawn  → the reviewer withdrew the review themselves
-- Either party may appeal a decision once, within `appeal_until`.
set search_path = rateme, extensions, public;

alter table disputes drop constraint if exists disputes_status_check;
alter table disputes add constraint disputes_status_check check (status in ('open','escalated','upheld','rejected','withdrawn'));

drop index if exists disputes_one_open;
create unique index disputes_one_active on disputes(review_id) where status in ('open','escalated');

alter table disputes add column if not exists reason_code text;
alter table disputes add column if not exists evidence text check (evidence is null or length(evidence) <= 3000);
alter table disputes add column if not exists reviewer_statement text check (reviewer_statement is null or length(reviewer_statement) <= 3000);
alter table disputes add column if not exists reviewer_responded_at timestamptz;
alter table disputes add column if not exists reminder_sent_at timestamptz;
alter table disputes add column if not exists escalated_at timestamptz;
alter table disputes add column if not exists escalation_reason text;
alter table disputes add column if not exists appeal_until timestamptz;

drop index if exists disputes_deadline;
create index if not exists disputes_deadline on disputes(deadline_at) where status = 'open';
create index if not exists disputes_escalated on disputes(escalated_at) where status = 'escalated';

alter table appeals add column if not exists dispute_id uuid references disputes(id) on delete set null;

-- Any reviews removed under the old "silence = removal" rule are flagged for a human look.
-- They are NOT republished automatically: a moderator decides, and the reviewer can still restore
-- them by reconfirming from their link.
insert into moderation_actions (review_id, action, reason, notes)
select d.review_id, 'legacy_auto_removal_flagged', 'Removed automatically under the previous no-reconfirmation rule',
       'Needs human review under the fair-dispute policy'
from disputes d join reviews r on r.id = d.review_id
where d.status = 'upheld' and d.decided_by is null and r.status = 'removed';

update settings set value = value || '{"reconfirm_days": 14, "reminder_days_before": 5, "appeal_days": 30}'::jsonb where key = 'disputes';
