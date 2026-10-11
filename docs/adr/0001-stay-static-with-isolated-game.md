# ADR 0001: Stay on static HTML; isolate the game as a client module

Status: accepted. Date: 2026-10.

## Context
Red Teddy Tutor is served as static HTML from Vercel with vanilla JavaScript. Accounts use
Supabase REST calls from the browser. The flagship game (Teddy's Bakery) uses Phaser 3.90.0,
vendored under `redteddytutor/learn/vendor/`, and mounts into one page.

## Decision
Keep the static foundation. Do not migrate to Next.js. Keep the game as an isolated module
with a pure learning layer, a controller, and a Phaser scene that only draws.

## Why
- Nothing needs server rendering today. The pages are public landing pages, or private
  and not indexed (`noindex`).
- A migration would move about 15 pages and rerun the CSP, routing and browser tests.
- The game is already testable without a framework.

## Revisit when
- Per-child pages need server rendering for performance or search.
- The screen count makes shared React components save real effort.
- Frontend work moves to a team that works mainly in React.

## Server-side work
Billing webhooks and other secret-holding code run as Vercel functions or Supabase edge
functions. Keep secret keys out of the browser.
