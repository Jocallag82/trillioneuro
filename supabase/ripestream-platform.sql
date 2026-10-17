-- RipeStream platform (v1): profiles, communities, posts, comments, follows,
-- mutes, feed preferences and reports.
--
-- Identity is the existing member key (rs_member_from_key): every RPC takes
-- p_key, resolves it server-side and only lets confirmed members
-- (status = 'member') in. Tables have RLS on and no policies, so nothing is
-- reachable except through these SECURITY DEFINER functions.
-- The feed is always reverse-chronological; members choose its sources.

create table if not exists public.rsp_profiles (
  member_id    uuid primary key references public.rs_members(id) on delete cascade,
  handle       text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio          text not null default '' check (char_length(bio) <= 280),
  created_at   timestamptz not null default now()
);

create table if not exists public.rsp_prefs (
  member_id   uuid primary key references public.rs_members(id) on delete cascade,
  feed_mode   text not null default 'all' check (feed_mode in ('following','communities','all')),
  muted_words text[] not null default '{}' check (cardinality(muted_words) <= 50),
  updated_at  timestamptz not null default now()
);

create table if not exists public.rsp_communities (
  id          bigint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,30}$'),
  name        text not null check (char_length(name) between 3 and 50),
  description text not null default '' check (char_length(description) <= 300),
  created_by  uuid references public.rs_members(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.rsp_memberships (
  community_id bigint not null references public.rsp_communities(id) on delete cascade,
  member_id    uuid not null references public.rs_members(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (community_id, member_id)
);
create index if not exists rsp_memberships_member on public.rsp_memberships(member_id);

create table if not exists public.rsp_follows (
  follower   uuid not null references public.rs_members(id) on delete cascade,
  followee   uuid not null references public.rs_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index if not exists rsp_follows_followee on public.rsp_follows(followee);

create table if not exists public.rsp_mutes (
  member_id  uuid not null references public.rs_members(id) on delete cascade,
  muted      uuid not null references public.rs_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, muted)
);

create table if not exists public.rsp_posts (
  id           bigint generated always as identity primary key,
  author       uuid not null references public.rs_members(id) on delete cascade,
  community_id bigint references public.rsp_communities(id) on delete set null,
  body         text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists rsp_posts_recent on public.rsp_posts(id desc) where deleted_at is null;
create index if not exists rsp_posts_author on public.rsp_posts(author, id desc);
create index if not exists rsp_posts_community on public.rsp_posts(community_id, id desc);

create table if not exists public.rsp_comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references public.rsp_posts(id) on delete cascade,
  author     uuid not null references public.rs_members(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists rsp_comments_post on public.rsp_comments(post_id, id);

create table if not exists public.rsp_reports (
  id          bigint generated always as identity primary key,
  reporter    uuid not null references public.rs_members(id) on delete cascade,
  kind        text not null check (kind in ('post','comment')),
  target_id   bigint not null,
  reason      text not null check (char_length(reason) between 1 and 500),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (reporter, kind, target_id)
);

alter table public.rsp_profiles    enable row level security;
alter table public.rsp_prefs       enable row level security;
alter table public.rsp_communities enable row level security;
alter table public.rsp_memberships enable row level security;
alter table public.rsp_follows     enable row level security;
alter table public.rsp_mutes       enable row level security;
alter table public.rsp_posts       enable row level security;
alter table public.rsp_comments    enable row level security;
alter table public.rsp_reports     enable row level security;

-- ── helpers (not exposed) ──────────────────────────────
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
  return v;
end $$;

create or replace function public.rsp_need_profile(p_me uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.rsp_profiles where member_id = p_me) then
    raise exception 'NO_PROFILE: choose a handle first' using errcode = '42501';
  end if;
end $$;

create or replace function public.rsp_author_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('handle', p.handle, 'name', p.display_name, 'founding', m.founding_number)
    from public.rsp_profiles p join public.rs_members m on m.id = p.member_id where p.member_id = p_id
$$;

create or replace function public.rsp_post_json(p public.rsp_posts, p_me uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'body', p.body, 'at', p.created_at,
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

-- ── read ───────────────────────────────────────────────
create or replace function public.rsp_me(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key);
begin
  return jsonb_build_object(
    'profile', (select jsonb_build_object('handle', handle, 'name', display_name, 'bio', bio) from public.rsp_profiles where member_id = v),
    'first_name', (select first_name from public.rs_members where id = v),
    'founding', (select founding_number from public.rs_members where id = v),
    'prefs', coalesce((select jsonb_build_object('mode', feed_mode, 'muted_words', to_jsonb(muted_words)) from public.rsp_prefs where member_id = v),
                      jsonb_build_object('mode', 'all', 'muted_words', '[]'::jsonb)),
    'muted', coalesce((select jsonb_agg(p.handle order by p.handle) from public.rsp_mutes m join public.rsp_profiles p on p.member_id = m.muted where m.member_id = v), '[]'::jsonb),
    'following', (select count(*) from public.rsp_follows where follower = v),
    'communities', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name) order by c.name)
                               from public.rsp_memberships s join public.rsp_communities c on c.id = s.community_id where s.member_id = v), '[]'::jsonb));
end $$;

create or replace function public.rsp_feed(p_key text, p_before bigint default null, p_community text default null, p_handle text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key);
  v_mode text; v_words text[]; v_cid bigint; v_aid uuid;
begin
  select feed_mode, muted_words into v_mode, v_words from public.rsp_prefs where member_id = v;
  v_mode := coalesce(v_mode, 'all'); v_words := coalesce(v_words, '{}');
  if p_community is not null then
    select id into v_cid from public.rsp_communities where slug = lower(p_community);
    if v_cid is null then raise exception 'NOT_FOUND: no such community' using errcode = 'P0002'; end if;
  end if;
  if p_handle is not null then
    select member_id into v_aid from public.rsp_profiles where handle = lower(p_handle);
    if v_aid is null then raise exception 'NOT_FOUND: no such member' using errcode = 'P0002'; end if;
  end if;
  return coalesce((
    select jsonb_agg(public.rsp_post_json(p, v) order by p.id desc) from (
      select p.* from public.rsp_posts p
       where p.deleted_at is null
         and (p_before is null or p.id < p_before)
         and (v_cid is null or p.community_id = v_cid)
         and (v_aid is null or p.author = v_aid)
         and (v_aid is not null or not exists (select 1 from public.rsp_mutes m where m.member_id = v and m.muted = p.author))
         and (v_aid is not null or p.author = v or not exists (select 1 from unnest(v_words) w where p.body ilike '%' || w || '%'))
         and (v_cid is not null or v_aid is not null or p.author = v or v_mode = 'all'
              or (v_mode = 'following' and exists (select 1 from public.rsp_follows f where f.follower = v and f.followee = p.author))
              or (v_mode = 'communities' and exists (select 1 from public.rsp_memberships s where s.member_id = v and s.community_id = p.community_id)))
       order by p.id desc limit 30) p), '[]'::jsonb);
end $$;

create or replace function public.rsp_comments(p_key text, p_post bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'body', c.body, 'at', c.created_at,
                     'author', public.rsp_author_json(c.author), 'mine', c.author = v) order by c.id)
     from public.rsp_comments c where c.post_id = p_post and c.deleted_at is null
      and not exists (select 1 from public.rsp_mutes m where m.member_id = v and m.muted = c.author)), '[]'::jsonb);
end $$;

create or replace function public.rsp_communities(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name, 'description', c.description,
       'members', (select count(*) from public.rsp_memberships s where s.community_id = c.id),
       'joined', exists (select 1 from public.rsp_memberships s where s.community_id = c.id and s.member_id = v))
     order by (select count(*) from public.rsp_memberships s where s.community_id = c.id) desc, c.name)
     from public.rsp_communities c), '[]'::jsonb);
end $$;

create or replace function public.rsp_profile(p_key text, p_handle text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key); r public.rsp_profiles;
begin
  select * into r from public.rsp_profiles where handle = lower(p_handle);
  if r.member_id is null then raise exception 'NOT_FOUND: no such member' using errcode = 'P0002'; end if;
  return public.rsp_author_json(r.member_id) || jsonb_build_object(
    'bio', r.bio, 'joined', r.created_at, 'me', r.member_id = v,
    'followers', (select count(*) from public.rsp_follows where followee = r.member_id),
    'following', (select count(*) from public.rsp_follows where follower = r.member_id),
    'i_follow', exists (select 1 from public.rsp_follows where follower = v and followee = r.member_id),
    'i_mute', exists (select 1 from public.rsp_mutes where member_id = v and muted = r.member_id));
end $$;

-- ── write ──────────────────────────────────────────────
create or replace function public.rsp_set_profile(p_key text, p_handle text, p_name text, p_bio text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_write', 120); h text := lower(btrim(coalesce(p_handle, '')));
begin
  if h !~ '^[a-z0-9_]{3,20}$' then raise exception 'BAD_HANDLE: 3–20 letters, numbers or underscores' using errcode = '22023'; end if;
  if h in ('admin','ripestream','support','help','official','moderator','staff') then
    raise exception 'HANDLE_TAKEN: that handle is reserved' using errcode = '23505'; end if;
  if exists (select 1 from public.rsp_profiles where handle = h and member_id <> v) then
    raise exception 'HANDLE_TAKEN: that handle is taken' using errcode = '23505'; end if;
  insert into public.rsp_profiles(member_id, handle, display_name, bio)
  values (v, h, left(btrim(coalesce(nullif(btrim(p_name), ''), h)), 40), left(btrim(coalesce(p_bio, '')), 280))
  on conflict (member_id) do update set handle = excluded.handle, display_name = excluded.display_name, bio = excluded.bio;
  return public.rsp_me(p_key);
end $$;

create or replace function public.rsp_set_prefs(p_key text, p_mode text, p_muted_words text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_write', 120); w text[];
begin
  if p_mode not in ('following','communities','all') then raise exception 'BAD_MODE' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct x), '{}') into w
    from (select lower(left(btrim(u), 40)) x from unnest(coalesce(p_muted_words, '{}')) u) s where x <> '';
  if cardinality(w) > 50 then raise exception 'TOO_MANY: up to 50 muted words' using errcode = '22023'; end if;
  insert into public.rsp_prefs(member_id, feed_mode, muted_words) values (v, p_mode, w)
  on conflict (member_id) do update set feed_mode = excluded.feed_mode, muted_words = excluded.muted_words, updated_at = now();
  return public.rsp_me(p_key);
end $$;

create or replace function public.rsp_post(p_key text, p_body text, p_community text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_post', 60); c bigint; p public.rsp_posts;
begin
  perform public.rsp_need_profile(v);
  if p_community is not null and p_community <> '' then
    select id into c from public.rsp_communities where slug = lower(p_community);
    if c is null then raise exception 'NOT_FOUND: no such community' using errcode = 'P0002'; end if;
    if not exists (select 1 from public.rsp_memberships where community_id = c and member_id = v) then
      raise exception 'NOT_JOINED: join the community to post in it' using errcode = '42501'; end if;
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'BAD_BODY: posts are 1–2000 characters' using errcode = '22023'; end if;
  insert into public.rsp_posts(author, community_id, body) values (v, c, btrim(p_body)) returning * into p;
  return public.rsp_post_json(p, v);
end $$;

create or replace function public.rsp_comment(p_key text, p_post bigint, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_post', 60);
begin
  perform public.rsp_need_profile(v);
  if not exists (select 1 from public.rsp_posts where id = p_post and deleted_at is null) then
    raise exception 'NOT_FOUND: that post is gone' using errcode = 'P0002'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'BAD_BODY: replies are 1–1000 characters' using errcode = '22023'; end if;
  insert into public.rsp_comments(post_id, author, body) values (p_post, v, btrim(p_body));
  return public.rsp_comments(p_key, p_post);
end $$;

create or replace function public.rsp_delete(p_key text, p_kind text, p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_write', 120);
begin
  -- Hard delete: the privacy notice promises deleted content is gone from the database.
  if p_kind = 'post' then
    delete from public.rsp_posts where id = p_id and author = v;
  elsif p_kind = 'comment' then
    delete from public.rsp_comments where id = p_id and author = v;
  else raise exception 'BAD_KIND' using errcode = '22023'; end if;
  return found;
end $$;

create or replace function public.rsp_create_community(p_key text, p_slug text, p_name text, p_description text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_community', 10); s text := lower(btrim(coalesce(p_slug, ''))); c bigint;
begin
  perform public.rsp_need_profile(v);
  if s !~ '^[a-z0-9-]{3,30}$' then raise exception 'BAD_SLUG: 3–30 letters, numbers or dashes' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 50 then raise exception 'BAD_NAME: names are 3–50 characters' using errcode = '22023'; end if;
  if exists (select 1 from public.rsp_communities where slug = s) then raise exception 'SLUG_TAKEN: that address is taken' using errcode = '23505'; end if;
  insert into public.rsp_communities(slug, name, description, created_by)
  values (s, btrim(p_name), left(btrim(coalesce(p_description, '')), 300), v) returning id into c;
  insert into public.rsp_memberships(community_id, member_id) values (c, v);
  return public.rsp_communities(p_key);
end $$;

create or replace function public.rsp_join(p_key text, p_slug text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_write', 120); c bigint;
begin
  select id into c from public.rsp_communities where slug = lower(p_slug);
  if c is null then raise exception 'NOT_FOUND: no such community' using errcode = 'P0002'; end if;
  if p_on then insert into public.rsp_memberships(community_id, member_id) values (c, v) on conflict do nothing;
  else delete from public.rsp_memberships where community_id = c and member_id = v; end if;
  return public.rsp_communities(p_key);
end $$;

create or replace function public.rsp_relate(p_key text, p_handle text, p_kind text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_write', 120); t uuid;
begin
  select member_id into t from public.rsp_profiles where handle = lower(p_handle);
  if t is null then raise exception 'NOT_FOUND: no such member' using errcode = 'P0002'; end if;
  if t = v then raise exception 'SELF: that is you' using errcode = '22023'; end if;
  if p_kind = 'follow' then
    if p_on then insert into public.rsp_follows values (v, t) on conflict do nothing;
    else delete from public.rsp_follows where follower = v and followee = t; end if;
  elsif p_kind = 'mute' then
    if p_on then insert into public.rsp_mutes values (v, t) on conflict do nothing;
    else delete from public.rsp_mutes where member_id = v and muted = t; end if;
  else raise exception 'BAD_KIND' using errcode = '22023'; end if;
  return public.rsp_profile(p_key, p_handle);
end $$;

create or replace function public.rsp_report(p_key text, p_kind text, p_id bigint, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_write', 120);
begin
  insert into public.rsp_reports(reporter, kind, target_id, reason)
  values (v, p_kind, p_id, left(btrim(coalesce(nullif(btrim(p_reason), ''), 'No reason given')), 500))
  on conflict do nothing;
  return true;
end $$;

-- ── exposure: only the RPCs, only through the API roles ─
do $$
declare f text;
begin
  foreach f in array array[
    'rsp_auth(text,text,int)', 'rsp_need_profile(uuid)', 'rsp_author_json(uuid)', 'rsp_post_json(public.rsp_posts,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'rsp_me(text)', 'rsp_feed(text,bigint,text,text)', 'rsp_comments(text,bigint)', 'rsp_communities(text)',
    'rsp_profile(text,text)', 'rsp_set_profile(text,text,text,text)', 'rsp_set_prefs(text,text,text[])',
    'rsp_post(text,text,text)', 'rsp_comment(text,bigint,text)', 'rsp_delete(text,text,bigint)',
    'rsp_create_community(text,text,text,text)', 'rsp_join(text,text,boolean)',
    'rsp_relate(text,text,text,boolean)', 'rsp_report(text,text,bigint,text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- Starter communities so the first members have somewhere to go. Empty — no
-- fake posts or members.
insert into public.rsp_communities(slug, name, description) values
  ('introductions', 'Introductions', 'New here? Say hello and tell people what you are into.'),
  ('feedback', 'RipeStream Feedback', 'Tell us what to build, fix or drop. Founding Members are asked first.'),
  ('photography', 'Photography', 'Your shots, gear and technique.'),
  ('local-events', 'Local Events', 'What is on near you this week.')
on conflict (slug) do nothing;

-- Defence in depth: RLS already blocks rows; also drop the default table grants.
revoke all on public.rsp_profiles, public.rsp_prefs, public.rsp_communities, public.rsp_memberships, public.rsp_follows, public.rsp_mutes, public.rsp_posts, public.rsp_comments, public.rsp_reports from anon, authenticated;
