-- Founders' Record: retention pruning + admin delete actions.
-- Run AFTER 20261014_te_beat_elon.sql. Idempotent. Contains DELETE statements, so it is applied
-- by hand in the Supabase SQL editor (the MCP tool cancels DELETE-bearing migrations).

create or replace function public.te_prune_retention() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.te_drafts d where d.status in ('draft','expired','cancelled','failed')
    and d.created_at < now() - interval '30 days'
    and not exists (select 1 from public.te_waitlist w where w.draft_id = d.id);
  delete from public.te_referral_clicks where created_at < now() - interval '12 months';
  delete from public.te_reports where created_at < now() - interval '24 months' and status <> 'open';
  delete from public.te_messages where created_at < now() - interval '24 months';
  delete from public.te_privacy_requests where created_at < now() - interval '24 months' and status <> 'open';
end $$;
revoke all on function public.te_prune_retention() from public, anon, authenticated;

create or replace function public.te_admin_journal_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  delete from public.te_journal where id = p_id;
  perform public.te_audit('journal_delete', p_id::text, null);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.te_admin_delete(p_kind text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.te_require_admin();
  if p_kind = 'milestone' then delete from public.te_milestones where id = p_id;
  elsif p_kind = 'metric' then delete from public.te_metrics where id = p_id;
  else raise exception 'INVALID_KIND' using errcode = '22023';
  end if;
  perform public.te_audit('delete:' || p_kind, p_id::text, null);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.te_admin_journal_delete(uuid) from public, anon;
revoke all on function public.te_admin_delete(text,uuid) from public, anon;
grant execute on function public.te_admin_journal_delete(uuid) to authenticated;
grant execute on function public.te_admin_delete(text,uuid) to authenticated;
