# Trillioneuro (+ Quadrillioneuro)

This repo now serves two domains from one Vercel project, routed by hostname (see `vercel.json`):

- **trillioneuro.com** — the world's first trillion-euro public record (files at repo root)
- **quadrillioneuro.com** — sister project: the auction for the top of that record — see `quadrillioneuro/README.md`
  (this is the "rank bidding + auction engine" roadmap item below, spun out as its own product instead of a
  feature bolted onto Trillioneuro)

## Stack
- Frontend: Plain HTML/CSS/JS — no framework needed at this stage
- Database: Supabase (Postgres + RLS) — **separate project per site**, do not share credentials between them
- Hosting: Vercel, one project, two custom domains, host-based rewrites
- Domains: trillioneuro.com, quadrillioneuro.com

## Files (trillioneuro.com — repo root)
- `index.html` — founding member pre-launch page (live now)
- `record.html` — full public ledger + monument wall (goes live at 10,000 founders)
- `privacy.html` / `terms.html` — legal pages
- `supabase-setup.sql` — run once in Supabase SQL editor to create the schema
- `vercel.json` — Vercel routing config for **both** domains

## Files (quadrillioneuro.com — `quadrillioneuro/`)
See `quadrillioneuro/README.md` for the full breakdown. Short version: `index.html` (registration landing),
`auction.html` (preview board), its own `privacy.html` / `terms.html` / `supabase-setup.sql`.

## Setup
1. Run `supabase-setup.sql` (trillioneuro) in your Supabase SQL editor. Supabase keys are already wired into `index.html`.
2. Run `quadrillioneuro/supabase-setup.sql` in a **separate, new** Supabase project, then paste those keys into
   `quadrillioneuro/index.html`'s config block (currently placeholder — runs in demo mode until you do this).
3. In Vercel, add `quadrillioneuro.com` as an additional domain on the same project that serves `trillioneuro.com`.
   The `has: host` rules in `vercel.json` route it to the `quadrillioneuro/` folder automatically.
4. Push to GitHub → Vercel auto-deploys both.

## Roadmap
### Trillioneuro
- [ ] Founder threshold reached → flip to full record
- [ ] €1 renewal flow (year two)
- [ ] Avatar moderation pipeline

### Quadrillioneuro
- [ ] First seat crosses 1,000 registrations → open real bidding (Stripe Checkout)
- [ ] First season closes → Hall of Champions goes from empty to real
- [ ] Recurring seasons
