# Red Teddy Tutor

Static site served for `redteddytutor.com` (see root `vercel.json`). Local preview with the
production CSP: `node scripts/dev-rtt.mjs` (port 4321; `/api/*` answers 503).

## Home page
`index.html` + `home.css` + `home.js`. The "Try a real question" panel imports the app's own
generators, marking (`engine.grade`) and mistake tips, so it can never show a question the app
could not. The skill list is rendered from `curriculum/framework.js`. Nothing is stored.
Copy rules: only describe what exists; Plus is "not on sale yet" until billing is connected.
`privacy.html` (`/privacy`) describes the data actually stored; keep it in step with the schema.

## News form (was early access)
Posts `{p_email, p_audience}` to the Supabase RPC `rtt_join` (project `trillioneuro`),
which inserts into `public.rtt_waitlist`. The table is RLS-locked with no anon grants;
the function validates, de-duplicates, rate-limits (5/hour/IP) and is the only anon entry point.
View sign-ups in the Supabase dashboard: Table editor -> `rtt_waitlist`.
Only email + optional audience are collected.

## Free learning activities (`/learn/`)
Static, no build step. Served from `redteddytutor.com/learn/` (routes in root `vercel.json`).
- `learn/js/content.js` — the starter library (29 activities, ages 2–3 / 3–5 / 5–7). Answers are pre-authored. Step kinds: `choice` (tap one option; `listen: true` plays the question aloud), `drop` (drag or tap each item onto its target: shapes into holes, grouping, pattern building) and `memory` (find matching pairs; the board is shuffled once per attempt).
- `learn/js/engine.js` — validation, answer checking, hints (two per question) and retries. A third miss reveals the answer without penalty.
- `learn/js/progress.js` — device-only progress in `localStorage` (`rtt.learn.v1`). Recommendations and trends use first-try answers only.
- `learn/js/player.js`, `learn/js/parent.js` — UI. Spoken instructions use the browser's speech synthesis, start only after a tap, and always appear as captions.
- `learn/parent.html` — parent summary of what that device recorded, with the ability to delete it.

Pages are `noindex`.

## Learning engine (ages 2–11)
- `learn/js/curriculum/framework.js` — subjects, strands and 43 objectives with prerequisites and usual ages. Objective ids are the `skill` ids stored with every answer.
- `learn/js/curriculum/generators.js` — rule-based practice for every objective (number lines, ten frames, typed answers, tile ordering, fractions, rulers, phonics, sentences). Wrong options built from a known mistake carry its code.
- `learn/js/curriculum/misconceptions.js` — the closed list of mistake codes. `locales.js` — en-GB/IE/US/AU words and stage names (labels only; no national curriculum has been mapped or reviewed).
- `learn/js/learner.js` — mastery (difficulty, independence and recency weighted, with confidence; adapted from GradeA/ExplainIt), spaced review, active mistakes, today's plan, and the adaptive placement check. Pure.
- `learn/js/tutor.js` + `api/rtt-tutor.mjs` (+ `api/_rtt/tutor-core.mjs`) — Teddy, the AI helper. Signed-in profiles only. Quota enforced in Supabase (`rtt_tutor_begin`, 20 turns/day free, 200 plus; 6/minute). The model never marks answers; replies that leak the answer, contain links or are malformed fall back to authored hints; unsafe messages get a fixed reply with no model call. No message text is stored. Uses the Vercel AI Gateway via the deployment's OIDC token or `AI_GATEWAY_API_KEY`; model `RTT_TUTOR_MODEL` (default Haiku 4.5, falls back to Sonnet 4.6).
- Database: `supabase/migrations/20261012_rtt_learning_engine.sql` (evidence columns, ages 7–11, locale, entitlements, tutor usage).

No billing provider is connected: `rtt_entitlements` exists for a future webhook and everyone is on the free plan.

Tests: `node --test scripts/*.test.mjs`. Browser: `PLAYWRIGHT_MODULE=… node scripts/learn-e2e.mjs [screenshot-dir]` and `scripts/game-e2e.mjs`.

## Ages 7 to 11 (added October 2026)
Eight skills, each with a rule-based generator and independent answer checks in
`scripts/curriculum.test.mjs`: telling the time (analogue clock), reading bar charts with scales,
two-step word problems, area and perimeter, decimals, spelling in context, reading comprehension
(six original passages; retrieval, inference, word choice) and logic puzzles (every puzzle is
solved by brute force in the tests to prove it has exactly one answer). New visuals in `dom.js`:
`clock`, `bars`, `grid`, `passage`. The comprehension passage is sent to the AI helper as context.

## K-12 for the US (October 2026)
- **Bands** now run to 14-18 (`11-14` middle school, `14-18` high school). DB constraint widened in
  `supabase/migrations/20261013_rtt_grades_6_12.sql` (additive).
- **Grades** (`curriculum/grades.js`): PK, K, 1-12 map onto bands. US is the default locale; the
  learner app asks for a grade in the US and stores it as `settings.grade`.
- **Catalogue** (`curriculum/catalogues/us.js`): courses, grade placement and related standards
  (Common Core math/ELA, NGSS) with `fit: aligned|partial`. Codes are only added when certain;
  tests check every code's shape. Social studies and computer science have no mapped codes.
- **Coverage** (`curriculum/coverage.js`): computed inventory, shown on `/curriculum`.
- **New objectives** (80 total): grades 6-12 maths (`gen-secondary-math.js`), English, science,
  social studies and computer science (`gen-subjects.js`). Every computed answer is re-solved
  independently in `scripts/secondary.test.mjs`; authored banks are checked for one right answer.
- **Lessons** (`curriculum/lessons.js`): shown before a learner's first practice of a skill.
- **Ask Red Teddy** (`learn/js/explore.js` + tutor mode `ask`): topic-level tutoring for
  signed-in families, same quotas and safety rules; older learners get an older voice.
- **Planning**: from middle school up, earlier-band prerequisites with no evidence are assumed
  for planning only; struggling sends the learner back to the missing foundation.
- Compliance notes: `docs/compliance/us-child-privacy.md`.

## Production-readiness pass (13 October 2026)
- **Curriculum**: 31 new skills (`curriculum/gen-expansion.js`), 111 in total, each with a lesson.
  Inventory: `node scripts/curriculum-inventory.mjs` → `docs/curriculum/inventory.json`; plan in
  `docs/curriculum/expansion-plan.md`. Re-solved in `scripts/expansion.test.mjs`.
- **Parent view**: child switcher for signed-in parents; "Can do independently", "Still uncertain,
  and why", "Mistakes that keep coming up" and a like-for-like trend, from `learn/js/insights.js`.
  Every conclusion is tagged Observed or Estimate and shows its evidence.
- **Device storage**: a synced child's copy lives under `rtt.learn.p.<profileId>`, apart from
  `rtt.learn.v1` (no account). Removed on sign-out, sign-in expiry and profile deletion.
- **Billing**: no Stripe code, keys, routes or webhooks exist. Plus stays "not on sale".
  `rtt_entitlements` is SELECT-only for clients.
- Browser tests: `PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node scripts/learn-e2e.mjs`
  (web fonts are stubbed so they run offline).
