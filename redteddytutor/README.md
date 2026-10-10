# Red Teddy Tutor landing page

Static page served for `redteddytutor.com` (see root `vercel.json`).

## Early-access form
Posts `{p_email, p_audience}` to the Supabase RPC `rtt_join` (project `trillioneuro`),
which inserts into `public.rtt_waitlist`. The table is RLS-locked with no anon grants;
the function validates, de-duplicates, rate-limits (5/hour/IP) and is the only anon entry point.
View sign-ups in the Supabase dashboard: Table editor -> `rtt_waitlist`.
Only email + optional audience are collected.
