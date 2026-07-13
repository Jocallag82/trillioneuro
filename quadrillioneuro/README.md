# Quadrillioneuro

The auction for the top of history. Sister site to [Trillioneuro](https://trillioneuro.com) — same repo, same
family, different mechanic.

Trillioneuro: 10,000 people get a permanent, free place in history.
Quadrillioneuro: one name holds #1 in the World, and one name holds #1 in each country — decided by open bidding
once enough people register interest in that seat.

## Stack
- Frontend: Plain HTML/CSS/JS — no framework, no build step
- Database: Supabase (Postgres + RLS) — separate project from Trillioneuro's
- Hosting: same Vercel project as trillioneuro.com, served via host-based routing (see root `vercel.json`)
- Domain: quadrillioneuro.com

## Files
- `index.html` — registration landing page (live now)
- `auction.html` — preview of the auction board (illustrative data — bidding isn't open yet)
- `privacy.html` / `terms.html` — legal pages (plain-English drafts — have a professional review before relying on them)
- `supabase-setup.sql` — run once in Supabase SQL editor to create the schema
- `hero-bg.webm` / `hero-bg.mp4` / `hero-poster.jpg` — reused from Trillioneuro's hero background (same gold-particle motif, ties the two brands together visually)
- `og-image.png` — Quadrillioneuro's own share image

## Setup
1. Create a **separate** Supabase project for Quadrillioneuro (don't reuse Trillioneuro's — different data, different business).
2. Run `supabase-setup.sql` in that project's SQL editor.
3. In `index.html`, find the `SUPABASE CONFIG` block and paste in the real `SUPABASE_URL` / `SUPABASE_ANON_KEY`.
   Until you do this, the page runs in local demo mode automatically — the registration flow completes end-to-end
   for testing, it just doesn't persist.
4. Add `quadrillioneuro.com` as a domain on the same Vercel project that serves `trillioneuro.com`, and point its
   DNS at Vercel. The root `vercel.json` routes requests by hostname to this folder.
5. Push to GitHub → Vercel auto-deploys.

## Growth mechanics built in
- **Referral queue-jumping** — every registrant gets a shareable link (`?r=CODE`); referrals move you up the line.
  This is the single most proven waitlist-virality mechanic (Robinhood, Clubhouse, etc.) — use it in the launch push.
- **Country pride** — every country gets its own seat, so this travels naturally across borders instead of being
  US/Ireland-only.
- **Honest scarcity** — real numbers aren't shown until they're worth showing (same lesson Trillioneuro's own git
  history already learned: "soft-launch: replace founder counts with narrative framing"). The `auction.html` preview
  is clearly labeled as illustrative so nobody mistakes mockup data for real traction.

## Roadmap
- [ ] First seat crosses 1,000 registrations → open real bidding (Stripe Checkout, not raw card fields)
- [ ] First season closes → first row in `quad_champions` (Hall of Champions goes from empty to real)
- [ ] Recurring seasons — the mechanic that brings people back
- [ ] Cross-link placement on trillioneuro.com once both are live (already added a light footer/lineage mention on both sides)
