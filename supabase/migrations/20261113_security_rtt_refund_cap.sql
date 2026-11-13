-- Security: rtt_tutor_finish was callable by any signed-in user and refunded a turn
-- on every p_ok=false call, so the daily tutor limit could be looped past.
-- Refunds are now capped at 3 per day per parent; token/failure accounting is unchanged.
create or replace function public.rtt_tutor_finish(p_input int, p_output int, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  update public.rtt_tutor_usage set
    input_tokens = input_tokens + greatest(0, least(coalesce(p_input, 0), 100000)),
    output_tokens = output_tokens + greatest(0, least(coalesce(p_output, 0), 100000)),
    failures = failures + case when p_ok then 0 else 1 end,
    turns = case when p_ok or failures >= 3 then turns else greatest(0, turns - 1) end
  where parent_id = v_uid and day = (now() at time zone 'utc')::date;
end;
$$;
revoke all on function public.rtt_tutor_finish(int, int, boolean) from public, anon;
grant execute on function public.rtt_tutor_finish(int, int, boolean) to authenticated;
