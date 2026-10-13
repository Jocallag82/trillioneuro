-- Free plan: 5 Ask Red Teddy messages a day (was 20). Plus stays at 200.
-- Edits the live function body in place so nothing else in it changes; grants are kept.
do $m$
declare d text := pg_get_functiondef('public.rtt_tutor_begin(uuid)'::regprocedure);
begin
  if position('else 20 end' in d) = 0 then raise exception 'free limit pattern not found'; end if;
  execute replace(d, 'else 20 end', 'else 5 end');
end $m$;
