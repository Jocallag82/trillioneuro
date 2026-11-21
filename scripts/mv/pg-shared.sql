-- Extracted from supabase-setup.sql (shared helpers) for local tests.
create table if not exists public.rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Client IP as PostgREST sees it. Only the first hop of x-forwarded-for is
-- the caller; the rest are trivially spoofable. Degrades to a shared
-- bucket rather than to "unlimited" when no header is present.
create or replace function public.client_ip()
returns text language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare v_hdrs json; v_xff text;
begin
  begin
    v_hdrs := nullif(current_setting('request.headers', true), '')::json;
  exception when others then return 'unknown';
  end;
  if v_hdrs is null then return 'unknown'; end if;
  v_xff := v_hdrs ->> 'x-forwarded-for';
  if v_xff is null or length(trim(v_xff)) = 0 then return 'unknown'; end if;
  return trim(split_part(v_xff, ',', 1));
end $$;
revoke all on function public.client_ip() from public, anon, authenticated;

create or replace function public.rl_allow(p_action text, p_limit integer, p_window interval)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_bucket text; v_window timestamptz; v_hits integer; v_secs numeric;
begin
  v_secs   := greatest(extract(epoch from p_window), 1);
  v_bucket := p_action || ':' || public.client_ip();
  v_window := to_timestamp(floor(extract(epoch from now()) / v_secs) * v_secs);

  insert into public.rate_limits (bucket, window_start, hits)
  values (v_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  delete from public.rate_limits where window_start < now() - (p_window * 4);
  return v_hits <= p_limit;
end $$;
revoke all on function public.rl_allow(text,integer,interval) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
--  SHARED: INPUT SANITISATION
--
--  Both public pages render names into innerHTML, so a 30-character name is
--  enough room for a stored XSS ('<img src=x onerror=...>' fits). The pages
--  escape on output too — this is the second layer so that a future page
--  which forgets cannot be exploited.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.clean_text(p_raw text)
returns text language sql immutable
set search_path = public, pg_temp as $$
  select nullif(btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_raw, ''), '[<>]', '', 'g'),
        '[\x00-\x1F\x7F]', ' ', 'g'),
      '\s+', ' ', 'g')), '');
$$;

