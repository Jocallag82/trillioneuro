# RateMe.ie

Ireland's business ratings platform: businesses claim a profile, verify ownership, take an annual
membership and get a permanent QR code; customers rate genuine previous experiences for free.

Independent Next.js app inside this repo (`rateme/`). It has its own Vercel project and its own
Postgres schema (`rateme`); it shares nothing with the other sites in the repo.

## Stack
- Next.js 16 (App Router, server actions), React 19, TypeScript, Tailwind CSS 4
- PostgreSQL via `postgres` (postgres.js). All tables in schema `rateme`; SQL migrations in `migrations/`
- Stripe Checkout (subscriptions) + verified webhooks; Resend for email (optional — outbox table otherwise)
- No Redis, no queues, no paid APIs: rate limits, sessions and stats live in Postgres

## Local development (Windows PowerShell)
```powershell
cd rateme
npm install
copy .env.example .env.local      # then edit DATABASE_URL etc.
npm run db:migrate
npm run db:seed:dev               # LOCAL ONLY — refuses non-localhost databases
npm run dev                       # http://localhost:3100
```
Dev seed logins: `admin@test.rateme.local` / `admin-password-123`. Seeded businesses are flagged
`is_test_data`, labelled "Test data" on screen and hidden whenever `APP_ENV=production`.

## Checks
```powershell
npm run typecheck; npm run lint
npm run test:unit                 # pure logic + webhook lifecycle against a local Postgres (rateme_test)
npm run build; npm run check:secrets
npm run test:e2e                  # Playwright: consumer, onboarding/payments, security, a11y, links, SEO, mobile
```

## Key rules (enforced in code)
| Rule | Where |
|---|---|
| Ratings are computed only from `published` reviews, by a DB trigger | `migrations/001_init.sql` (`refresh_business_rating`) |
| Screening never looks at the star rating (no gating); breaches blocked at submit, conflicts auto-rejected | `src/lib/screening.ts`, `src/lib/reviews.ts` |
| Hands-off disputes: reviewer must reconfirm within 14 days or the review is auto-removed (daily cron); 3 reports = dispute; 5 disputes / business / 30 days | `src/lib/disputes.ts` |
| One live review per email per business | unique index `reviews_one_per_reviewer` |
| Membership granted only from verified Stripe webhooks, idempotent, order-safe | `src/lib/billing.ts`, `src/app/api/stripe/webhook` |
| Account / claimed / ownership verified / paid are separate states | `users`, `business_members`, `businesses.ownership_verified_at`, `subscriptions` |
| Pending claimants see only the verification step | `src/lib/dashboard.ts` |
| Expired membership keeps profile, reviews and QR redirects | `src/lib/entitlement.ts`, `/r/[code]` |
| Server-side RBAC for /admin (moderator vs admin) | `requireStaff()` in every admin page and action |
| Audit trail for moderation and sensitive actions | `moderation_actions`, `audit_events` |

## Membership expiry policy
Profile and legitimate reviews stay public; printed QR codes keep resolving. QR downloads, profile
editing, review replies and activity insights pause. Disputing reviews stays free for verified owners.
Failed renewals get a configurable grace period (default 14 days). Full refunds and card disputes
suspend member tools.

## Operations
- First admin: sign up normally, confirm email, then `node scripts/create-admin.mjs you@domain.ie`.
- Prices / founding plan / grace period: `/admin/pricing` (no deploy). Categories: `/admin/categories`.
- Stripe webhook endpoint: `https://<domain>/api/stripe/webhook` with events
  `checkout.session.completed, checkout.session.async_payment_succeeded, customer.subscription.*,
  invoice.paid, invoice.payment_failed, charge.refunded, charge.dispute.created, charge.dispute.closed`.
- Daily retention job: Vercel Cron → `/api/cron/maintenance` (needs `CRON_SECRET`).
- Live billing needs both a live key **and** `ALLOW_LIVE_PAYMENTS=true`.
- Indexing is off unless `APP_ENV=production` **and** `ALLOW_INDEXING=true` (set only on the real domain).

Environment variables: see `.env.example`.
