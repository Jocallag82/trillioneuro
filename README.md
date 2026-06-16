# Trillioneuro

The world's first trillion-euro public record.

## Stack
- Frontend: Plain HTML/CSS/JS — no framework needed at this stage
- Database: Supabase (Postgres + RLS)
- Hosting: Vercel
- Domain: trillioneuro.com

## Files
- `index.html` — founding member pre-launch page (live now)
- `record.html` — full public ledger + monument wall (goes live at 1,000 founders)
- `supabase-setup.sql` — run once in Supabase SQL editor to create the schema
- `vercel.json` — Vercel routing config

## Setup
1. Run `supabase-setup.sql` in your Supabase SQL editor
2. Supabase keys are already wired into `index.html`
3. Push to GitHub → Vercel auto-deploys

## Roadmap
- [ ] Founder threshold reached → flip to full record
- [ ] €1 renewal flow (year two)
- [ ] Rank bidding + auction engine
- [ ] Avatar moderation pipeline
