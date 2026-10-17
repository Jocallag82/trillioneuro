# businessbooster-customer-demos

Private, access-gated, non-indexable website demonstrations for **BusinessBooster.ie** (operated by Conjora).
Independent Next.js app — it shares nothing with the other projects in this repository and deploys as its own Vercel project (root directory `businessbooster-customer-demos`).

## Layers

| Layer | Where |
| --- | --- |
| BusinessBooster identity | `app/page.tsx`, `app/access` (no prospect named anywhere public) |
| Shared demo infrastructure | `middleware.ts`, `lib/` (registry, sessions, rate limit), `components/` (generic, prospect-free UI) |
| Per-customer demo | `app/demos/<slug>/` — own layout, data, artwork, disclaimer |
| Future live customer sites | Separate repo + Vercel project. Never served from this app. |

## Access protection

- `middleware.ts` gates `/demos/*` (HTML, RSC payloads, prefetches). Unknown slug, no session and wrong-demo session all get the same `303 → /access`, so the gate never confirms a prospect exists.
- Access codes live only in env vars (`DEMO_TOKENS_<ID>`, comma-separated). Each code unlocks exactly one demo.
- Sessions: HMAC-SHA256 signed, `HttpOnly`, `Secure`, `SameSite=Lax` cookie, 7-day default TTL. The cookie stores a fingerprint of the code used, so **removing a code revokes every session opened with it**. Rotating `DEMO_SESSION_SECRET` signs everyone out of everything.
- Demo artwork is rendered inside gated server components; nothing customer-specific is in `/public` or client JS bundles (`grep -ri mccloskey .next/static` is empty).
- Access attempts are rate-limited (8 per 15 min per IP, per instance — best-effort on serverless; 144-bit random codes make guessing infeasible regardless).
- Logout is POST-only so link prefetching can never end a session.
- Missing/short `DEMO_SESSION_SECRET` ⇒ no access can be granted (fails closed).

### Issue / revoke / disable

```powershell
npm run token:new                      # prints a new code + share link
```

1. Add the code to `DEMO_TOKENS_MCCLOSKEYS_BAKERY` in Vercel (Project → Settings → Environment Variables), redeploy.
2. Share `https://<host>/access/enter?code=<code>` (or the bare code for the `/access` form).
3. Revoke: remove the code from the variable and redeploy.
4. Pause/withdraw a demo: set `status: "disabled"` or `"withdrawn"` in `lib/demos.ts` → returns `410`, even to signed-in visitors.

## Search-engine exclusion

`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` on every response; `<meta name="robots" content="noindex,nofollow">` on every page; `robots.txt` disallows `/demos/`, `/access`, `/logout`; no sitemap; no canonical, Open Graph or structured data on demo pages; `Cache-Control: private, no-store` on demo routes.

## Environment variables

See `.env.example`.

| Name | Required | Purpose |
| --- | --- | --- |
| `DEMO_SESSION_SECRET` | yes | ≥32 random chars, signs session cookies |
| `DEMO_TOKENS_<DEMO_ID>` | yes per demo | Comma-separated access codes (≥12 chars each) |
| `DEMO_SESSION_TTL_HOURS` | no | Session lifetime, default 168 |

## Add the next customer demo

1. Add an entry to `DEMOS` in `lib/demos.ts` (`id`, `slug`, `prospectName`, `status`, `disclaimer`).
2. Copy `app/demos/mccloskeys-bakery/` to `app/demos/<slug>/`; replace `_data/content.ts` (verified facts only) and restyle the layout. Reuse `components/` for nav, ordering and enquiry demos.
3. Set `DEMO_TOKENS_<ID>` in Vercel and redeploy.

## McCloskey's Bakery concept

Routes: home, celebration cakes (catalogue + detail with demo ordering journey), bread & bakery, location finder + 6 location pages, trade & wholesale (demo enquiry form), our story, contact, custom 404/error.

Facts come from mccloskeysbakery.ie, Irish Food & Drink, Guild of Fine Food and Wholesale Directory (listed in `_data/content.ts`). Unverified items (cake names/prices/sizes, one shop phone number) are flagged "to be confirmed" or omitted. All artwork is original, code-drawn SVG — **provisional** placeholders for commissioned or licensed photography. No order, payment or enquiry is ever transmitted.

## Develop & test

```powershell
npm install
copy .env.example .env.local   # fill in values
npm run dev
npm run typecheck; npm run lint; npm run build
npm run test:e2e               # runs against `next start` (production build)
$env:BASE_URL="https://<deployment>"; $env:DEMO_TEST_CODE="<code>"; npm run test:e2e
```
