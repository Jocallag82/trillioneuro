# Red Teddy Tutor landing page

Static page served for `redteddytutor.com` (see root `vercel.json`).

## Early-access form
Posts `{p_email, p_audience}` to the Supabase RPC `rtt_join` (project `trillioneuro`),
which inserts into `public.rtt_waitlist`. The table is RLS-locked with no anon grants;
the function validates, de-duplicates, rate-limits (5/hour/IP) and is the only anon entry point.
View sign-ups in the Supabase dashboard: Table editor -> `rtt_waitlist`.
Only email + optional audience are collected.

## Free learning activities (`/learn/`)
Static, no build step. Served from `redteddytutor.com/learn/` (routes in root `vercel.json`).
- `learn/js/content.js` — the starter library (20 activities, ages 2–3 / 3–5 / 5–7). Answers are pre-authored.
- `learn/js/engine.js` — validation, answer checking, hints (two per question) and retries. A third miss reveals the answer without penalty.
- `learn/js/progress.js` — device-only progress in `localStorage` (`rtt.learn.v1`). Recommendations and trends use first-try answers only.
- `learn/js/player.js`, `learn/js/parent.js` — UI. Spoken instructions use the browser's speech synthesis, start only after a tap, and always appear as captions.
- `learn/parent.html` — parent summary of what that device recorded, with the ability to delete it.

Pages are `noindex`. No accounts, payments or server-side storage exist yet. Test: `node --test scripts/learn.test.mjs`.
