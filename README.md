# Trillioneuro + Quadrillioneuro + RipeStream

Three products, one repo, one Vercel project, one Supabase project — routed by hostname
(see `vercel.json`).

| | **trillioneuro.com** | **quadrillioneuro.com** |
|---|---|---|
| What it is | A free global movement: €1 trillion of value, put back into the world | Civilisation-scale scenario engine |
| Core features | Founding contributors, country communities, live map & leaderboard, priority voting, invitations | AI electricity, EV takeover, clean-energy investment, any-market-at-scale, the quadrillion clock |
| Files | `index.html`, `assets/mv/`, `site-src/` | `quadrillioneuro/index.html`, `quadrillioneuro/lib/scenario.js` |
| Retired | The paid “Beat Elon” Founders’ Record — old URLs redirect (see `vercel.json`) | `/seats` (seat registration) and `/auction`, unlinked |

## The rule both sites live by

Every number is labelled: **Fact** (published, source and date named — see `FACTS` in the two
`lib/` modules), **Estimate** (derived from facts, with the working shown), **Assumption** (the
visitor's input or an editable default) or **Scenario/Calculated** (arithmetic on those — never a
forecast). Nothing is stored server-side; saved analyses live in the visitor's browser and share
links carry assumptions in the URL hash.

Animation (progressive enhancement, no dependencies; reduced-motion and no-JS fall back to static pages):
trillioneuro.com — `assets/mv/globe.js` and CSS motion; quadrillioneuro.com — `quadrillioneuro/wow.{js,css}` (quadrillioneuro.com: nebula-tunnel WebGL, warp stars that react to every slider,
pinned powers-of-ten "Ascent"). Tests: `node --test scripts/wow.test.mjs`.

Tests: `node --test scripts/scale.test.mjs` · routing: `node scripts/check-routes.mjs` ·
`node scripts/check-vercel-json.mjs`.

## Stack
- **Frontend** — plain HTML/CSS/JS. No framework, no build step, no `package.json`.
  Deliberate: these are two mostly-static pages, and a build step would be the largest
  source of complexity in the project.
- **Database** — Supabase (Postgres + RLS), project `kxzywyflylkcqoidiqmo`, EU (Ireland).
  Both sites' tables live here; Quadrillioneuro's are all `quad_*`-prefixed.
- **Hosting** — Vercel, project `trillioneuro`, both domains attached, host-based routing.
- **Analytics** — Vercel Web Analytics + Speed Insights, first-party, no cookies.

## Files

**trillioneuro.com** (repo root)
- `index.html` — landing + claim flow
- `record.html` — the public record (`/record`); reads real rows from `founders_public`
- `privacy.html` / `terms.html` — legal
- `supabase-setup.sql` — the **whole** schema for both sites, idempotent, with a
  self-verifying check block at the end
- `vercel.json` — routing, redirects and security headers for both domains

**quadrillioneuro.com** (`quadrillioneuro/`)
- `index.html` — landing + seat registration
- `auction.html` — the seat board (`/auction`); reads real counts from `quad_seat_counts`
- `privacy.html` / `terms.html` — legal

Media (`hero-bg.webm`/`.mp4`, `hero-poster.jpg`, `og-image.png`) is duplicated in both
locations because host routing serves each site from its own folder.

## RipeStream (`ripestream/`)

**ripestream.com** — landing page and Founding Member / invite-only launch for a social
platform in development. Same stack and rules as the other two sites: plain HTML/CSS/JS, no build step.

| File | What it is |
|---|---|
| `ripestream/index.html` | The page. All CSS inline (no render-blocking stylesheet). Readable with JS off. |
| `ripestream/app.js` | Progressive enhancement: reveal-on-scroll, concept demos, live founding counter, join submit, `?invite=` handling |
| `ripestream/wow.js` | The animation layer (no dependencies): WebGL "ripening" shader background that shifts raw→ripe with scroll, intro curtain, split-text, pinned scroll-driven story, 3D auto-cycling phone, magnetic buttons, cursor, marquee, confetti on join. Everything degrades: no JS = static page, reduced motion = one still frame, no WebGL = CSS gradient |
| `ripestream/member.html` / `member.js` | `/member` — Founding Member status + invitations (create, copy, share, withdraw) |
| `ripestream/privacy.html` / `terms.html` | Legal, scoped to the interest list |
| `ripestream/fonts/` | Self-hosted Bricolage Grotesque + Inter (latin, variable weight, OFL) — no Google Fonts request |
| `ripestream/og-image.png`, `favicon.svg`, `apple-touch-icon.png` | Share card and icons |

- **Launch model** (all enforced in Postgres — see *RIPESTREAM — FOUNDING MEMBERS* in
  `supabase-setup.sql`, tested incl. 30 concurrent confirmations at #9,991–#10,000):
  - `rs_join(email, first_name, invite, source)` creates a *pending* member and emails a link.
    Nobody holds a place until they open it: `rs_member_open(key)` confirms the email and, while
    places remain, issues the next **founding number** from the single `rs_founding` counter row
    (row-locked → sequential, never past the limit, never reused). Founding numbers and member
    status are immutable (trigger). Once `issued = founding_limit` (10,000), `rs_join` refuses
    anyone without a valid invitation (`INVITE_REQUIRED`); the page flips to invite-only from
    `rs_founding_status()`. The page never shows how many places are claimed or remain — only open vs. invite-only.
  - Invitations: `rs_create_invite` / `rs_revoke_invite` — `invites_per_month` (5) per calendar
    month UTC, single-use 8-char codes, expire after `invite_ttl_days` (30), inviter recorded as
    `invited_by`. Change limits live: `update rs_settings set value = … where key = …`.
  - No passwords yet: members hold a 256-bit key emailed as `/member#k=…`; only its SHA-256 is
    stored and only the service role can mint one (Edge Function `rs-member`).
  - **Emails need the SMTP password in Vault** (`rs_smtp_pass`). Until it's set, joins queue with
    `mail_kind` set and nobody can confirm. After setting it: `select public.rs_member_mail_backlog();`
    — this also emails the people carried over from the old interest list.
- **Legacy registrations** went to `rs_interests` via `rs_register_interest(email, first_name, source)` —
  the only thing anon can do. Validated, sanitised, rate-limited (10/hour/IP), and a repeat
  email is a silent no-op that returns the same response, so the endpoint can't be used to
  check whether someone is on the list. Export: see the bottom of `supabase-setup.sql`.
- **Honesty rule** (same spirit as the other sites): no invented users, dates, press or
  features. Everything product-shaped on the page is labelled concept / example.
- **Routing**: host `ripestream.com` and `www.ripestream.com` (matched with `{"inc": [...]}`)
  rewrite to `/ripestream/*`; `trillioneuro.com/ripestream/*` 308s to the real domain.
  `check-routes.mjs` now understands `inc`/`eq` host matchers.
- **Mail**: `hello@` and `privacy@ripestream.com` are published — set up forwarding.
- **Emails on sign-up**: an `AFTER INSERT` trigger on `rs_interests` calls the Edge Function
  `supabase/functions/rs-notify` (via `pg_net`), which sends the registrant a confirmation and
  the owner an alert over Google Workspace SMTP (`smtp.gmail.com:465`), then stamps
  `notified_at` (one-shot, so replays send nothing). Credentials are Vault secrets
  `rs_smtp_user`, `rs_smtp_pass`, `rs_admin_email`, `rs_from`, read only by the service role.
  Rows that arrived before the password was set: `select public.rs_notify_backlog();`
- **Hero**: a fixed full-page WebGL fragment shader (`#gl`, half-resolution, adaptive, pauses in background tabs) plus the 3D phone; `flow.js`/`#flow` is no longer used by the page.


## Trillion Euro — the movement (trillioneuro.com)

A free global movement: *make €1 trillion of value and put it back into the world.* Phase 1 builds the community —
founding contributors, country communities, a vote on what to tackle first, and invitations. **No payments of any kind**;
€1 trillion is an aspiration, never a balance. Plain HTML/CSS/JS like the rest of the repo (see
`docs/adr/0001-stay-static-with-isolated-game.md` — Next.js was deliberately not introduced).

- **Pages**: authored in `site-src/pages/*.html`, wrapped by `node site-src/build.mjs` into the root `*.html`
  (committed; still no build step on Vercel). The builder is locale-aware (`LOCALES`, `site-src/i18n/en.json`, hreflang).
- **Browser code** (`assets/mv/`, no dependencies): `mv.js` core (Supabase Auth over REST, RPC, referral capture, share, motion
  helpers) · `globe.js` hero globe + stars (Canvas 2D) · `map.js` SVG world map + leaderboard · `vote.js` · `join.js` ·
  `dashboard.js` · `country.js` · `share.js` (canvas share graphics) · `art.js` (bespoke SVG illustrations). Map data is generated by
  `scripts/mv/build-geo.mjs` from Natural Earth (public domain) into `world.json` / `land.json`.
- **Server**: `api/mv-render.mjs` (`/countries/:slug` — per-country title, canonical, Open Graph, JSON-LD and a
  server-rendered summary), `api/mv-sitemap.mjs`. Both read only the public aggregate RPCs.
- **Database** (`supabase/migrations/20261121_mv_movement.sql`, idempotent, `mv_*` only; the retired `te_*` Beat Elon tables are untouched):
  `mv_profiles`, `mv_countries`, `mv_rounds`, `mv_ideas`, `mv_votes`, `mv_referrals`, `mv_invites`, `mv_announcements`, `mv_milestones`,
  `mv_counters`, `mv_country_counts`, `mv_settings`. No client can write a table: every write is a `SECURITY DEFINER` RPC that validates,
  sanitises and rate-limits. A profile is created by a trigger on `auth.users` (only for sign-ups carrying `mv=1` metadata, so the
  other products sharing this project are untouched). One vote per user per round is the primary key. Referral attribution is written once,
  by the database, at sign-up. Counters and milestones are maintained by triggers; `mv_recount()` rebuilds them from source rows.
- **Privacy**: public pages get aggregates only; personal rows are RLS-limited to their owner. Self-service export
  (`mv_export_my_data`) and erasure (`mv_delete_account`, which removes the login unless another product on this project uses it).
- **Operations & launch dependencies**: `docs/movement-launch.md`.
- **Tests** (all must pass before a push):
  `sh scripts/mv/run-db-tests.sh` (migrations twice + SQL tests: RLS, vote integrity, referrals, GDPR, milestones, rate limits) ·
  `node --test scripts/mv/api.test.mjs scripts/mv/site.test.mjs` · `node scripts/mv/e2e.mjs` (Playwright against a real local
  Postgres; emulates PostgREST + Supabase Auth, runs the triggers) · `node scripts/check-routes.mjs` · `node scripts/check-vercel-json.mjs`.

## Routing (`vercel.json`)

JSON has no comments and **Vercel rejects any unknown property in a route object**,
which fails the deployment at schema validation *before the build starts* — producing an
error with no build logs at all. So the reasoning lives here instead, and
`node scripts/check-vercel-json.mjs` guards it.

The file uses the legacy `routes` key rather than `rewrites`/`redirects`/`headers`/`cleanUrls`.
That is deliberate and is the crux of the whole setup: **`routes` is the only routing
property evaluated *before* the filesystem.** `rewrites` run *after* it, so on
quadrillioneuro.com a request for `/privacy` would be answered by the root (Trillioneuro)
`privacy.html` before any rewrite could redirect it — silently serving the wrong brand's
legal page. Vercel also refuses to combine the two styles, so this file commits to one.

Route groups, in order:

1. **Security headers**, then **immutable media caching** — both `continue: true`, so they
   add headers and keep routing instead of swallowing the host rules below.
2. **`www` → apex**, both domains. Both `www` hosts are attached to the project and were
   serving complete duplicate copies of each site while every canonical tag pointed at the
   apex.
3. **`trillioneuro.com/quadrillioneuro/*` → `quadrillioneuro.com`.** The sister site's files
   physically live in that folder, so the whole of it was reachable — and indexable — on the
   wrong domain.
4. **quadrillioneuro.com → `/quadrillioneuro/`.** The catch-all is
   `/((?!_vercel/).*)`; without that exclusion it rewrote `/_vercel/insights/script.js` into
   a path that does not exist, which would have left analytics silently dead on that domain
   only.
5. **`.html` → extensionless `308`s on both hosts**, then **clean URLs for
   trillioneuro.com**. Internal links used `.html` while `sitemap.xml` listed the
   extensionless form: a redirect hop per click and two URLs per page for search engines.
   The quad host's redirects must sit *before* its catch-all or they are never reached.

Two checks guard all of this — run both before pushing a routing change:

```
node scripts/check-vercel-json.mjs   # schema-legal: no property Vercel would reject
node scripts/check-routes.mjs        # replays the table in order, asserts every URL
```

## Setup / operations

1. Run `supabase-setup.sql` in the Supabase SQL editor. It is safe to re-run against the
   live project, and the `VERIFY` select at the bottom must return `ok:` for every check.
2. Supabase keys are already wired into the four HTML files. They are *publishable* keys and
   are meant to ship in the browser — access is gated by column grants and RLS, not by
   hiding the key. There is no service-role key anywhere in this repo, and there must never be.
3. `.github/workflows/keep-alive.yml` reads one row daily so the free-tier project is never
   paused for inactivity.

## Two things are required before this can convert anyone

**1. quadrillioneuro.com does not resolve.** The domain is registered and is attached to the
Vercel project, but its DNS is not pointed at Vercel — `getaddrinfo ENOTFOUND`. The site has
therefore never been reachable by anyone, which is why `quad_interests` is empty, and the
cross-links to it from trillioneuro.com are dead. Fix in the registrar's DNS using the exact
records Vercel shows for that domain (Project → Settings → Domains).

**2. Mail is not set up.** `hello@` and `privacy@` on both domains are published in the legal
pages and footers, and the privacy policy commits to answering data requests within 30 days.
Set up forwarding for both addresses on both domains. Separately, nothing on either site can
*send* email yet, while both promise to — see the "STILL TO BUILD" note at the end of
`supabase-setup.sql`.

## Security model — read before editing the database

- `anon` has **no SELECT privilege on any `email` column.** Not "a policy denies it" — the
  column grant does not exist, so it stays unreachable even if a policy is later loosened
  by mistake.
- All writes go through `SECURITY DEFINER` functions with a **pinned `search_path`**, which
  validate, sanitise (`clean_text`) and rate-limit (`rl_allow`) server-side. Browser-side
  validation is a convenience, never a control.
- The public views are `security_invoker`, so they hold no privilege of their own.
- Names are escaped on output *and* stripped of `<`/`>` on input. Both pages render names
  into `innerHTML`, so either layer alone would be one forgotten page away from a stored XSS.

## Roadmap

### Trillioneuro
- [ ] Transactional email (nothing sends today, and the modal promises otherwise)
- [ ] Reach 10,000 names → open the full record
- [ ] €1/year badge renewal (year two) — `payments` table, never mutate `founders`
- [ ] Avatar upload + moderation, then restore the columns to `founders_public`

### Quadrillioneuro
- [ ] **Point the DNS.** Nothing else on this list matters until this is done.
- [ ] First seat crosses 1,000 registrations → open bidding via Stripe Checkout
- [ ] Season close → first `quad_champions` row
- [ ] Recurring seasons
