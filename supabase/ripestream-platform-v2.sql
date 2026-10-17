-- RipeStream platform v2: notifications, @mentions, images, moderation.
-- Apply after ripestream-platform.sql.
--
-- Admins are listed by email in rsp_admins (seed it by hand, not in git):
--   insert into public.rsp_admins(email) values ('you@example.com');

-- ── tables ─────────────────────────────────────────────
create table if not exists public.rsp_notifications (
  id         bigint generated always as identity primary key,
  member_id  uuid not null references public.rs_members(id) on delete cascade,
  kind       text not null check (kind in ('reply','follow','mention')),
  actor      uuid not null references public.rs_members(id) on delete cascade,
  post_id    bigint references public.rsp_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists rsp_notifications_member on public.rsp_notifications(member_id, id desc);

create table if not exists public.rsp_admins (
  email text primary key check (email = lower(email))
);

create table if not exists public.rsp_suspensions (
  member_id  uuid primary key references public.rs_members(id) on delete cascade,
  reason     text not null default '',
  created_at timestamptz not null default now()
);

-- One row per uploaded image. post_id is set when a post uses it; `used`
-- stays true after the post is deleted so the purge removes the file.
create table if not exists public.rsp_uploads (
  path       text primary key check (path ~ '^[0-9a-f-]{36}\.(jpg|png|gif|webp)$'),
  member_id  uuid not null references public.rs_members(id) on delete cascade,
  post_id    bigint unique references public.rsp_posts(id) on delete set null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists rsp_uploads_member on public.rsp_uploads(member_id, created_at desc);

alter table public.rsp_posts add column if not exists image_path text;

alter table public.rsp_notifications enable row level security;
alter table public.rsp_admins        enable row level security;
alter table public.rsp_suspensions   enable row level security;
alter table public.rsp_uploads       enable row level security;
revoke all on public.rsp_notifications, public.rsp_admins, public.rsp_suspensions, public.rsp_uploads from anon, authenticated;

-- Public bucket: files have random, unlisted names; the app itself is members-only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rsp-media', 'rsp-media', true, 5242880, array['image/jpeg','image/png','image/gif','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/gif','image/webp'];

-- ── helpers ────────────────────────────────────────────
create or replace function public.rsp_auth(p_key text, p_bucket text default 'rsp_read', p_limit int default 600)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.rl_allow(p_bucket, p_limit, interval '1 hour') then
    raise exception 'RATE_LIMIT: slow down a little' using errcode = '54000';
  end if;
  v := public.rs_member_from_key(p_key);
  if v is null then raise exception 'INVALID_KEY: sign in again from your member link' using errcode = '28000'; end if;
  if not exists (select 1 from public.rs_members where id = v and status = 'member') then
    raise exception 'NOT_MEMBER: confirm your membership first' using errcode = '42501';
  end if;
  if exists (select 1 from public.rsp_suspensions where member_id = v) then
    raise exception 'SUSPENDED: this account is suspended — email hello@ripestream.com' using errcode = '42501';
  end if;
  return v;
end $$;

create or replace function public.rsp_is_admin(p_me uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rsp_admins a join public.rs_members m on lower(m.email) = a.email where m.id = p_me)
$$;

create or replace function public.rsp_media_url(p_path text)
returns text language sql immutable as $$
  select case when p_path is null then null
    else 'https://kxzywyflylkcqoidiqmo.supabase.co/storage/v1/object/public/rsp-media/' || p_path end
$$;

create or replace function public.rsp_post_json(p public.rsp_posts, p_me uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'body', p.body, 'at', p.created_at, 'image', public.rsp_media_url(p.image_path),
    'author', public.rsp_author_json(p.author),
    'mine', p.author = p_me,
    'community', (select jsonb_build_object('slug', c.slug, 'name', c.name) from public.rsp_communities c where c.id = p.community_id),
    'comments', (select count(*) from public.rsp_comments x where x.post_id = p.id and x.deleted_at is null),
    'why', case
      when p.author = p_me then 'yours'
      when exists (select 1 from public.rsp_follows f where f.follower = p_me and f.followee = p.author) then 'following'
      when exists (select 1 from public.rsp_memberships s where s.member_id = p_me and s.community_id = p.community_id) then 'community'
      else 'everyone' end)
$$;

-- ── notifications (written by triggers) ────────────────
create or replace function public.rsp_notify(p_to uuid, p_kind text, p_actor uuid, p_post bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_to is null or p_to = p_actor then return; end if;
  if exists (select 1 from public.rsp_mutes where member_id = p_to and muted = p_actor) then return; end if;
  insert into public.rsp_notifications(member_id, kind, actor, post_id) values (p_to, p_kind, p_actor, p_post);
end $$;

create or replace function public.rsp_notify_mentions(p_body text, p_actor uuid, p_post bigint)
returns void language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  for t in
    select distinct pr.member_id
      from regexp_matches(p_body, '(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,20})', 'g') m
      join public.rsp_profiles pr on pr.handle = lower(m[1])
     limit 10
  loop perform public.rsp_notify(t, 'mention', p_actor, p_post); end loop;
end $$;

create or replace function public.rsp_tg_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.rsp_notify_mentions(new.body, new.author, new.id);
  return new;
end $$;
create or replace trigger rsp_post_notify after insert on public.rsp_posts for each row execute function public.rsp_tg_post();

create or replace function public.rsp_tg_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.rsp_notify((select author from public.rsp_posts where id = new.post_id), 'reply', new.author, new.post_id);
  perform public.rsp_notify_mentions(new.body, new.author, new.post_id);
  return new;
end $$;
create or replace trigger rsp_comment_notify after insert on public.rsp_comments for each row execute function public.rsp_tg_comment();

create or replace function public.rsp_tg_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.rsp_notifications where member_id = new.followee and actor = new.follower
                   and kind = 'follow' and created_at > now() - interval '1 day') then
    perform public.rsp_notify(new.followee, 'follow', new.follower, null);
  end if;
  return new;
end $$;
create or replace trigger rsp_follow_notify after insert on public.rsp_follows for each row execute function public.rsp_tg_follow();

-- Deleting a post leaves its upload orphaned; ask the media function to purge.
create or replace function public.rsp_tg_post_deleted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.image_path is not null then
    begin
      perform net.http_post(
        url     := 'https://kxzywyflylkcqoidiqmo.supabase.co/functions/v1/rsp-media',
        body    := jsonb_build_object('purge', true),
        headers := '{"Content-Type":"application/json"}'::jsonb);
    exception when others then null;
    end;
  end if;
  return old;
end $$;
create or replace trigger rsp_post_purge after delete on public.rsp_posts for each row execute function public.rsp_tg_post_deleted();

-- ── member RPCs ────────────────────────────────────────
create or replace function public.rsp_me(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key);
begin
  return jsonb_build_object(
    'profile', (select jsonb_build_object('handle', handle, 'name', display_name, 'bio', bio) from public.rsp_profiles where member_id = v),
    'first_name', (select first_name from public.rs_members where id = v),
    'founding', (select founding_number from public.rs_members where id = v),
    'admin', public.rsp_is_admin(v),
    'unread', (select count(*) from public.rsp_notifications where member_id = v and read_at is null),
    'prefs', coalesce((select jsonb_build_object('mode', feed_mode, 'muted_words', to_jsonb(muted_words)) from public.rsp_prefs where member_id = v),
                      jsonb_build_object('mode', 'all', 'muted_words', '[]'::jsonb)),
    'muted', coalesce((select jsonb_agg(p.handle order by p.handle) from public.rsp_mutes m join public.rsp_profiles p on p.member_id = m.muted where m.member_id = v), '[]'::jsonb),
    'following', (select count(*) from public.rsp_follows where follower = v),
    'communities', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name) order by c.name)
                               from public.rsp_memberships s join public.rsp_communities c on c.id = s.community_id where s.member_id = v), '[]'::jsonb));
end $$;

create or replace function public.rsp_unread(p_key text)
returns int language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key);
begin
  return (select count(*) from public.rsp_notifications where member_id = v and read_at is null);
end $$;

create or replace function public.rsp_notifications(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key); r jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'at', n.created_at, 'unread', n.read_at is null,
      'actor', public.rsp_author_json(n.actor), 'post', n.post_id,
      'snippet', (select left(p.body, 120) from public.rsp_posts p where p.id = n.post_id)) order by n.id desc), '[]'::jsonb)
    into r
    from (select * from public.rsp_notifications where member_id = v order by id desc limit 50) n
   where exists (select 1 from public.rsp_profiles where member_id = n.actor);
  update public.rsp_notifications set read_at = now() where member_id = v and read_at is null;
  return r;
end $$;

create or replace function public.rsp_post_get(p_key text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key); p public.rsp_posts;
begin
  select * into p from public.rsp_posts where id = p_id and deleted_at is null;
  if p.id is null then raise exception 'NOT_FOUND: that post is gone' using errcode = 'P0002'; end if;
  return public.rsp_post_json(p, v);
end $$;

-- Supersedes rsp_post(text,text,text); callers pass p_image by name.
create or replace function public.rsp_post(p_key text, p_body text, p_community text default null, p_image text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_post', 60); c bigint; p public.rsp_posts; b text := btrim(coalesce(p_body, ''));
begin
  perform public.rsp_need_profile(v);
  if p_community is not null and p_community <> '' then
    select id into c from public.rsp_communities where slug = lower(p_community);
    if c is null then raise exception 'NOT_FOUND: no such community' using errcode = 'P0002'; end if;
    if not exists (select 1 from public.rsp_memberships where community_id = c and member_id = v) then
      raise exception 'NOT_JOINED: join the community to post in it' using errcode = '42501'; end if;
  end if;
  if p_image is not null and not exists (select 1 from public.rsp_uploads where path = p_image and member_id = v and not used) then
    raise exception 'BAD_IMAGE: upload the image again' using errcode = '22023'; end if;
  if char_length(b) not between 1 and 2000 then
    raise exception 'BAD_BODY: posts are 1–2000 characters' using errcode = '22023'; end if;
  insert into public.rsp_posts(author, community_id, body, image_path) values (v, c, b, p_image) returning * into p;
  if p_image is not null then update public.rsp_uploads set post_id = p.id, used = true where path = p_image; end if;
  return public.rsp_post_json(p, v);
end $$;

-- ── moderation ─────────────────────────────────────────
create or replace function public.rsp_admin_reports(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key);
begin
  if not public.rsp_is_admin(v) then raise exception 'FORBIDDEN: admins only' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'latest') desc) from (
    select jsonb_build_object(
      'kind', r.kind, 'target', r.target_id,
      'reports', count(*), 'latest', max(r.created_at),
      'reasons', jsonb_agg(r.reason order by r.id),
      'ids', jsonb_agg(r.id),
      'content', case r.kind
        when 'post' then (select jsonb_build_object('body', p.body, 'image', public.rsp_media_url(p.image_path), 'author', public.rsp_author_json(p.author), 'at', p.created_at) from public.rsp_posts p where p.id = r.target_id)
        else (select jsonb_build_object('body', c.body, 'author', public.rsp_author_json(c.author), 'at', c.created_at, 'post', c.post_id) from public.rsp_comments c where c.id = r.target_id) end) x
    from public.rsp_reports r where r.resolved_at is null
    group by r.kind, r.target_id) s), '[]'::jsonb);
end $$;

create or replace function public.rsp_admin_act(p_key text, p_kind text, p_target bigint, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_write', 600); a uuid;
begin
  if not public.rsp_is_admin(v) then raise exception 'FORBIDDEN: admins only' using errcode = '42501'; end if;
  if p_kind not in ('post','comment') or p_action not in ('dismiss','remove','suspend') then
    raise exception 'BAD_ACTION' using errcode = '22023'; end if;
  if p_kind = 'post' then select author into a from public.rsp_posts where id = p_target;
  else select author into a from public.rsp_comments where id = p_target; end if;
  if p_action in ('remove','suspend') then
    if p_kind = 'post' then delete from public.rsp_posts where id = p_target;
    else delete from public.rsp_comments where id = p_target; end if;
  end if;
  if p_action = 'suspend' and a is not null and a <> v then
    insert into public.rsp_suspensions(member_id, reason) values (a, 'Reported ' || p_kind || ' ' || p_target) on conflict do nothing;
  end if;
  update public.rsp_reports set resolved_at = now() where kind = p_kind and target_id = p_target and resolved_at is null;
  return public.rsp_admin_reports(p_key);
end $$;

-- ── exposure ───────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'rsp_is_admin(uuid)', 'rsp_notify(uuid,text,uuid,bigint)', 'rsp_notify_mentions(text,uuid,bigint)',
    'rsp_tg_post()', 'rsp_tg_comment()', 'rsp_tg_follow()', 'rsp_tg_post_deleted()',
    'rsp_auth(text,text,int)', 'rsp_post_json(public.rsp_posts,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'rsp_me(text)', 'rsp_unread(text)', 'rsp_notifications(text)', 'rsp_post_get(text,bigint)',
    'rsp_post(text,text,text,text)', 'rsp_admin_reports(text)', 'rsp_admin_act(text,text,bigint,text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- The v1 three-argument rsp_post stays defined but is no longer callable.
revoke all on function public.rsp_post(text,text,text) from public, anon, authenticated;
