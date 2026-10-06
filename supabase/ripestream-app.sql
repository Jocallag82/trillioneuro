-- ════════════════════════════════════════════════════════════════════
--  RIPESTREAM V1 — APP SCHEMA (not yet applied to production)
--
--  Mirrors ripestream/app/js/store.js one table per concept so the preview
--  adapter can be swapped for a Supabase one without touching the UI.
--  Auth: Supabase Auth (magic link). Every table has RLS on.
--  Ranking stays out of SQL: rs_feed_candidates() returns a bounded,
--  already-filtered candidate set (≤ 400 rows, last 7 days) and the same
--  rank.js scores it — on the client today, in an Edge Function later.
--  Apply:  psql "$DB_URL" -f supabase/ripestream-app.sql
-- ════════════════════════════════════════════════════════════════════

create schema if not exists rsa;
grant usage on schema rsa to anon, authenticated;

create table if not exists rsa.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        text unique not null check (handle ~ '^[a-z0-9._]{3,20}$'),
  name          text not null check (char_length(name) between 2 and 40),
  bio           text not null default '' check (char_length(bio) <= 200),
  avatar_path   text,
  area          text,                         -- broad area id only, never coordinates
  show_area     boolean not null default false,
  is_private    boolean not null default false,
  discoverable  boolean not null default true,
  reply_policy  text not null default 'everyone' check (reply_policy in ('everyone','following','nobody')),
  is_team       boolean not null default false,
  suspended_at  timestamptz,
  invited_by    uuid references rsa.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create table if not exists rsa.interests (user_id uuid references rsa.profiles(id) on delete cascade, topic text not null, primary key (user_id, topic));
create table if not exists rsa.follows (
  follower uuid references rsa.profiles(id) on delete cascade, followee uuid references rsa.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (follower, followee), check (follower <> followee));
create index if not exists follows_followee_idx on rsa.follows (followee);
create table if not exists rsa.communities (
  id text primary key, name text not null, emoji text, category text not null, description text not null,
  area text, topics text[] not null default '{}', rules text[] not null default '{}', created_at timestamptz not null default now());
create table if not exists rsa.memberships (
  user_id uuid references rsa.profiles(id) on delete cascade, community_id text references rsa.communities(id) on delete cascade,
  role text not null default 'member' check (role in ('member','moderator')), created_at timestamptz not null default now(),
  primary key (user_id, community_id));
create index if not exists memberships_comm_idx on rsa.memberships (community_id);
create table if not exists rsa.posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references rsa.profiles(id) on delete cascade,
  community_id text references rsa.communities(id) on delete set null,
  area text, kind text not null default 'post' check (kind in ('post','question','event')),
  body text not null default '' check (char_length(body) <= 2000), image_path text,
  topics text[] not null default '{}',
  event_title text, event_date date, event_time time, event_place text,
  is_starter boolean not null default false,
  status text not null default 'visible' check (status in ('visible','held','removed')),
  created_at timestamptz not null default now());
create index if not exists posts_recent_idx on rsa.posts (created_at desc) where status = 'visible';
create index if not exists posts_author_idx on rsa.posts (author, created_at desc);
create index if not exists posts_comm_idx on rsa.posts (community_id, created_at desc);
create index if not exists posts_area_idx on rsa.posts (area, created_at desc);
create table if not exists rsa.comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references rsa.posts(id) on delete cascade,
  author uuid not null references rsa.profiles(id) on delete cascade, parent_id uuid references rsa.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible','held','removed')), created_at timestamptz not null default now());
create index if not exists comments_post_idx on rsa.comments (post_id, created_at);
create table if not exists rsa.reactions (user_id uuid references rsa.profiles(id) on delete cascade, post_id uuid references rsa.posts(id) on delete cascade, created_at timestamptz not null default now(), primary key (user_id, post_id));
create table if not exists rsa.rsvps (user_id uuid references rsa.profiles(id) on delete cascade, post_id uuid references rsa.posts(id) on delete cascade, created_at timestamptz not null default now(), primary key (user_id, post_id));
create table if not exists rsa.blocks (blocker uuid references rsa.profiles(id) on delete cascade, blocked uuid references rsa.profiles(id) on delete cascade, created_at timestamptz not null default now(), primary key (blocker, blocked));
-- Feed preferences are one JSON doc per user: mode, mix, adjust, mute, not_interested, inferred, notify.
create table if not exists rsa.feed_prefs (user_id uuid primary key references rsa.profiles(id) on delete cascade, prefs jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
create table if not exists rsa.reports (
  id uuid primary key default gen_random_uuid(), reporter uuid not null references rsa.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','user','community')), target_id text not null,
  reason text not null, note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolved_by uuid references rsa.profiles(id), resolved_at timestamptz, created_at timestamptz not null default now(),
  unique (reporter, target_type, target_id));
create table if not exists rsa.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references rsa.profiles(id) on delete cascade,
  type text not null check (type in ('follow','reply','like','community','event')), actor uuid references rsa.profiles(id) on delete cascade,
  post_id uuid references rsa.posts(id) on delete cascade, community_id text, body text, read_at timestamptz, created_at timestamptz not null default now());
create index if not exists notif_user_idx on rsa.notifications (user_id, created_at desc);
create table if not exists rsa.invites (code text primary key, inviter uuid not null references rsa.profiles(id) on delete cascade, community_id text references rsa.communities(id), used_by uuid references rsa.profiles(id), created_at timestamptz not null default now());
create table if not exists rsa.events_log (id bigserial primary key, user_id uuid references rsa.profiles(id) on delete cascade, name text not null, props jsonb, created_at timestamptz not null default now());
create index if not exists events_log_name_idx on rsa.events_log (name, created_at);

-- ── helpers ─────────────────────────────────────────────────────────
create or replace function rsa.blocked_between(a uuid, b uuid) returns boolean language sql stable security definer set search_path = rsa as
$$ select exists (select 1 from rsa.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a)) $$;
create or replace function rsa.can_see_author(author uuid) returns boolean language sql stable security definer set search_path = rsa as
$$ select author = auth.uid()
     or (not rsa.blocked_between(author, auth.uid())
         and not exists (select 1 from rsa.profiles p where p.id = author and p.suspended_at is not null)
         and (not (select is_private from rsa.profiles where id = author)
              or exists (select 1 from rsa.follows f where f.follower = auth.uid() and f.followee = author))) $$;
create or replace function rsa.is_mod(c text) returns boolean language sql stable security definer set search_path = rsa as
$$ select exists (select 1 from rsa.memberships where user_id = auth.uid() and community_id = c and role = 'moderator')
       or exists (select 1 from rsa.profiles where id = auth.uid() and is_team) $$;
create or replace function rsa.rate_ok(p_name text, p_limit int, p_window interval) returns boolean language sql stable security definer set search_path = rsa as
$$ select count(*) < p_limit from rsa.events_log where user_id = auth.uid() and name = p_name and created_at > now() - p_window $$;

-- ── RLS ─────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['profiles','interests','follows','communities','memberships','posts','comments','reactions','rsvps','blocks','feed_prefs','reports','notifications','invites','events_log'] loop
    execute format('alter table rsa.%I enable row level security', t);
    execute format('grant select on rsa.%I to authenticated', t);
  end loop; end $$;
grant insert, update, delete on rsa.profiles, rsa.interests, rsa.follows, rsa.memberships, rsa.posts, rsa.comments, rsa.reactions, rsa.rsvps, rsa.blocks, rsa.feed_prefs, rsa.reports, rsa.notifications, rsa.invites, rsa.events_log to authenticated;
grant usage on sequence rsa.events_log_id_seq to authenticated;
grant select on rsa.communities to anon;                        -- public community pages are indexable

drop policy if exists p_profiles_read on rsa.profiles;
create policy p_profiles_read on rsa.profiles for select using (suspended_at is null and not rsa.blocked_between(id, auth.uid()));
drop policy if exists p_profiles_write on rsa.profiles;
create policy p_profiles_write on rsa.profiles for all using (id = auth.uid()) with check (id = auth.uid() and is_team = false and suspended_at is null);
drop policy if exists p_interests on rsa.interests;
create policy p_interests on rsa.interests for all using (user_id = auth.uid() or rsa.can_see_author(user_id)) with check (user_id = auth.uid());
drop policy if exists p_follows_read on rsa.follows;
create policy p_follows_read on rsa.follows for select using (true);
drop policy if exists p_follows_write on rsa.follows;
create policy p_follows_write on rsa.follows for insert with check (follower = auth.uid() and not rsa.blocked_between(follower, followee) and rsa.rate_ok('follow', 60, '1 hour'));
drop policy if exists p_follows_del on rsa.follows;
create policy p_follows_del on rsa.follows for delete using (follower = auth.uid() or followee = auth.uid());
drop policy if exists p_comm_read on rsa.communities;
create policy p_comm_read on rsa.communities for select using (true);
drop policy if exists p_mem_read on rsa.memberships;
create policy p_mem_read on rsa.memberships for select using (true);
drop policy if exists p_mem_join on rsa.memberships;
create policy p_mem_join on rsa.memberships for insert with check (user_id = auth.uid() and role = 'member');
drop policy if exists p_mem_leave on rsa.memberships;
create policy p_mem_leave on rsa.memberships for delete using (user_id = auth.uid() or rsa.is_mod(community_id));
drop policy if exists p_posts_read on rsa.posts;
create policy p_posts_read on rsa.posts for select using ((status = 'visible' or author = auth.uid() or rsa.is_mod(community_id)) and rsa.can_see_author(author));
drop policy if exists p_posts_insert on rsa.posts;
create policy p_posts_insert on rsa.posts for insert with check (author = auth.uid() and status = 'visible' and is_starter = false
  and (community_id is null or exists (select 1 from rsa.memberships m where m.user_id = auth.uid() and m.community_id = posts.community_id))
  and rsa.rate_ok('post', 5, '10 minutes'));
drop policy if exists p_posts_delete on rsa.posts;
create policy p_posts_delete on rsa.posts for delete using (author = auth.uid());
drop policy if exists p_posts_mod on rsa.posts;
create policy p_posts_mod on rsa.posts for update using (rsa.is_mod(community_id)) with check (true);
drop policy if exists p_comments_read on rsa.comments;
create policy p_comments_read on rsa.comments for select using ((status = 'visible' or author = auth.uid()) and rsa.can_see_author(author)
  and exists (select 1 from rsa.posts p where p.id = post_id));
drop policy if exists p_comments_insert on rsa.comments;
create policy p_comments_insert on rsa.comments for insert with check (author = auth.uid() and status = 'visible' and rsa.rate_ok('comment', 20, '10 minutes')
  and exists (select 1 from rsa.posts p join rsa.profiles a on a.id = p.author where p.id = post_id and p.status = 'visible'
    and not rsa.blocked_between(p.author, auth.uid())
    and (a.id = auth.uid() or a.reply_policy = 'everyone' or (a.reply_policy = 'following' and exists (select 1 from rsa.follows f where f.follower = a.id and f.followee = auth.uid())))));
drop policy if exists p_comments_del on rsa.comments;
create policy p_comments_del on rsa.comments for delete using (author = auth.uid());
drop policy if exists p_comments_mod on rsa.comments;
create policy p_comments_mod on rsa.comments for update using (exists (select 1 from rsa.posts p where p.id = post_id and rsa.is_mod(p.community_id))) with check (true);
drop policy if exists p_react on rsa.reactions;
create policy p_react on rsa.reactions for all using (true) with check (user_id = auth.uid());
drop policy if exists p_rsvp on rsa.rsvps;
create policy p_rsvp on rsa.rsvps for all using (true) with check (user_id = auth.uid());
drop policy if exists p_blocks on rsa.blocks;
create policy p_blocks on rsa.blocks for all using (blocker = auth.uid()) with check (blocker = auth.uid());
drop policy if exists p_prefs on rsa.feed_prefs;
create policy p_prefs on rsa.feed_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists p_reports_insert on rsa.reports;
create policy p_reports_insert on rsa.reports for insert with check (reporter = auth.uid() and status = 'open' and rsa.rate_ok('report', 10, '1 hour'));
drop policy if exists p_reports_read on rsa.reports;
create policy p_reports_read on rsa.reports for select using (reporter = auth.uid() or exists (select 1 from rsa.profiles where id = auth.uid() and is_team)
  or (target_type = 'post' and exists (select 1 from rsa.posts p where p.id::text = target_id and rsa.is_mod(p.community_id))));
drop policy if exists p_reports_mod on rsa.reports;
create policy p_reports_mod on rsa.reports for update using (exists (select 1 from rsa.profiles where id = auth.uid() and is_team)
  or (target_type = 'post' and exists (select 1 from rsa.posts p where p.id::text = target_id and rsa.is_mod(p.community_id)))) with check (true);
drop policy if exists p_notif on rsa.notifications;
create policy p_notif on rsa.notifications for select using (user_id = auth.uid());
drop policy if exists p_notif_read on rsa.notifications;
create policy p_notif_read on rsa.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists p_invites on rsa.invites;
create policy p_invites on rsa.invites for all using (inviter = auth.uid()) with check (inviter = auth.uid() and used_by is null and rsa.rate_ok('invite_created', 5, '30 days'));
drop policy if exists p_log on rsa.events_log;
create policy p_log on rsa.events_log for insert with check (user_id = auth.uid());

-- ── notifications are written by triggers, never by clients ─────────
create or replace function rsa.notify_trg() returns trigger language plpgsql security definer set search_path = rsa as $$
begin
  if tg_table_name = 'follows' then
    insert into rsa.notifications (user_id, type, actor) values (new.followee, 'follow', new.follower);
  elsif tg_table_name = 'comments' then
    insert into rsa.notifications (user_id, type, actor, post_id)
      select p.author, 'reply', new.author, p.id from rsa.posts p where p.id = new.post_id and p.author <> new.author;
  end if;
  return new;
end $$;
drop trigger if exists follows_notify on rsa.follows;
create trigger follows_notify after insert on rsa.follows for each row execute function rsa.notify_trg();
drop trigger if exists comments_notify on rsa.comments;
create trigger comments_notify after insert on rsa.comments for each row execute function rsa.notify_trg();

-- Three distinct open reports hold a post for human review.
create or replace function rsa.report_trg() returns trigger language plpgsql security definer set search_path = rsa as $$
begin
  if new.target_type = 'post' and (select count(distinct reporter) from rsa.reports where target_type = 'post' and target_id = new.target_id and status = 'open') >= 3 then
    update rsa.posts set status = 'held' where id::text = new.target_id and status = 'visible';
  end if;
  return new;
end $$;
drop trigger if exists reports_hold on rsa.reports;
create trigger reports_hold after insert on rsa.reports for each row execute function rsa.report_trg();

-- ── bounded feed candidates; ranking happens in rank.js ─────────────
create or replace function rsa.feed_candidates(p_limit int default 400)
returns setof rsa.posts language sql stable security invoker set search_path = rsa as $$
  select p.* from rsa.posts p
  where p.created_at > now() - interval '7 days' and p.status = 'visible'
  order by p.created_at desc limit least(p_limit, 400)
$$;
grant execute on function rsa.feed_candidates(int) to authenticated;
