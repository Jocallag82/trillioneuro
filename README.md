# Trillioneuro + Quadrillioneuro

Two products, one repo, one Vercel project, one Supabase project — routed by hostname
(see `vercel.json`).

| | **trillioneuro.com** | **quadrillioneuro.com** |
|---|---|---|
| What it is | A numbered public list, kept in join order | An auction for the top position |
| Files | repo root | `quadrillioneuro/` |
| Primary action | Claim your number (free) | Register interest in a seat (free) |
| Role in the funnel | Audience — free, wide, shareable | Revenue — one buyer per seat |
| Status | Live | **DNS not configured — see below** |

## How they relate

Quadrillioneuro is not a separate business. It is the monetisation layer for the audience
Trillioneuro builds: Trillioneuro answers "were you here", Quadrillioneuro answers "were you
first", and only the second one has anyone willing to pay real money. They therefore share
infrastructure deliberately (one database, one deployment, one keep-alive) while keeping
separate branding, separate legal pages and separate canonical domains.

Consequence worth remembering: **do not put the revenue mechanic behind the free product's
signup.** Trillioneuro stays free and stays wide; the €1/year badge is disclosed but is not
the business.

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
5. **Clean URLs for trillioneuro.com**, then `.html` → extensionless `308`s. Internal links
   used `.html` while `sitemap.xml` listed the extensionless form: a redirect hop per click
   and two URLs per page for search engines.

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
