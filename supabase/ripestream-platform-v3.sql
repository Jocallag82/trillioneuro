-- RipeStream platform v3: profile pictures, email alerts for replies and
-- mentions, public community directory. Apply after v2.

alter table public.rsp_profiles      add column if not exists avatar_path text;
alter table public.rsp_prefs         add column if not exists email_notify boolean not null default true;
alter table public.rsp_notifications add column if not exists emailed_at timestamptz;
alter table public.rsp_uploads       add column if not exists kept boolean not null default false;

create or replace function public.rsp_author_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('handle', p.handle, 'name', p.display_name, 'founding', m.founding_number,
                            'avatar', public.rsp_media_url(p.avatar_path))
    from public.rsp_profiles p join public.rs_members m on m.id = p.member_id where p.member_id = p_id
$$;

create or replace function public.rsp_me(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key);
begin
  return jsonb_build_object(
    'profile', (select jsonb_build_object('handle', handle, 'name', display_name, 'bio', bio, 'avatar', public.rsp_media_url(avatar_path)) from public.rsp_profiles where member_id = v),
    'first_name', (select first_name from public.rs_members where id = v),
    'founding', (select founding_number from public.rs_members where id = v),
    'admin', public.rsp_is_admin(v),
    'unread', (select count(*) from public.rsp_notifications where member_id = v and read_at is null),
    'prefs', coalesce((select jsonb_build_object('mode', feed_mode, 'muted_words', to_jsonb(muted_words), 'email_notify', email_notify) from public.rsp_prefs where member_id = v),
                      jsonb_build_object('mode', 'all', 'muted_words', '[]'::jsonb, 'email_notify', true)),
    'muted', coalesce((select jsonb_agg(p.handle order by p.handle) from public.rsp_mutes m join public.rsp_profiles p on p.member_id = m.muted where m.member_id = v), '[]'::jsonb),
    'following', (select count(*) from public.rsp_follows where follower = v),
    'communities', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name) order by c.name)
                               from public.rsp_memberships s join public.rsp_communities c on c.id = s.community_id where s.member_id = v), '[]'::jsonb));
end $$;

-- p_path null removes the picture. The upload must be the caller's and unused.
create or replace function public.rsp_set_avatar(p_key text, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_write', 120); old text;
begin
  perform public.rsp_need_profile(v);
  if p_path is not null and not exists (select 1 from public.rsp_uploads where path = p_path and member_id = v and not used) then
    raise exception 'BAD_IMAGE: upload the image again' using errcode = '22023'; end if;
  select avatar_path into old from public.rsp_profiles where member_id = v;
  update public.rsp_profiles set avatar_path = p_path where member_id = v;
  -- kept = live profile picture; the old one becomes purgeable (used, unattached, not kept)
  if old is not null then update public.rsp_uploads set kept = false, used = true where path = old; end if;
  if p_path is not null then update public.rsp_uploads set used = true, kept = true where path = p_path; end if;
  return public.rsp_me(p_key);
end $$;

create or replace function public.rsp_set_email_notify(p_key text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public.rsp_auth(p_key, 'rsp_write', 120);
begin
  insert into public.rsp_prefs(member_id, email_notify) values (v, coalesce(p_on, true))
  on conflict (member_id) do update set email_notify = excluded.email_notify, updated_at = now();
  return public.rsp_me(p_key);
end $$;

-- Reply and mention notifications are also emailed (rsp-mail decides whether).
create or replace function public.rsp_tg_notification_mail() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind in ('reply','mention') then
    begin
      perform net.http_post(
        url     := 'https://kxzywyflylkcqoidiqmo.supabase.co/functions/v1/rsp-mail',
        body    := jsonb_build_object('id', new.id),
        headers := '{"Content-Type":"application/json"}'::jsonb);
    exception when others then null;
    end;
  end if;
  return new;
end $$;
create or replace trigger rsp_notification_mail after insert on public.rsp_notifications
  for each row execute function public.rsp_tg_notification_mail();

-- Public directory: community metadata and aggregate counts only, never
-- member content or identities.
create or replace function public.rsp_public_communities()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', c.slug, 'name', c.name, 'description', c.description, 'created', c.created_at,
      'members', (select count(*) from public.rsp_memberships s where s.community_id = c.id),
      'posts_30d', (select count(*) from public.rsp_posts p where p.community_id = c.id and p.created_at > now() - interval '30 days'),
      'active', (select max(p.created_at) from public.rsp_posts p where p.community_id = c.id))
    order by c.name), '[]'::jsonb)
  from public.rsp_communities c
$$;

do $$
declare f text;
begin
  execute 'revoke all on function public.rsp_tg_notification_mail() from public, anon, authenticated';
  foreach f in array array['rsp_me(text)', 'rsp_set_avatar(text,text)', 'rsp_set_email_notify(text,boolean)', 'rsp_public_communities()'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
