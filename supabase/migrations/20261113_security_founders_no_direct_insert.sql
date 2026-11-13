-- Security: anon could INSERT into public.founders directly, skipping reserve_founder()
-- (validation, sanitising, rate limit). reserve_founder() is SECURITY DEFINER and
-- does not need this grant.
drop policy if exists "anyone can reserve a place" on public.founders;
revoke insert on public.founders from anon;
