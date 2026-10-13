# TrillionEuro.com — Beat Elon / Founders' Record: launch dependencies

Status: **paid entries are OFF**. The product is live in preview/waitlist mode. Checkout
requires all three gates, each enforced server-side:

1. `te_settings.payments_enabled = true` (admin dashboard → Settings & payments).
2. Operator legal name **and** geographic address set (`operator_name`, `operator_address`) —
   the database refuses both the flag and every checkout without them.
3. Vercel env: `TE_PAYMENTS_LIVE=true`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `SUPABASE_SECRET_KEY`.

Nothing below is legal advice and nothing here certifies compliance. Each item needs sign-off
from a qualified Irish/EU professional before gate 1 is switched on.

## Must be resolved before enabling payments

| # | Area | Question for the professional | Where it lives in the product |
|---|------|------------------------------|-------------------------------|
| 1 | Trader identity (Consumer Rights Act 2022; Directive 2011/83 art. 6) | Which legal person sells the entry (sole trader or company)? Publish name, geographic address, email. | Settings → operator fields; shown on /about, /terms, /privacy, /contact |
| 2 | Product classification | Confirm an entry is "digital content" (not a service, not a voucher, not a lottery/prize scheme). Confirm the referral titles (non-monetary) don't create a promotional-competition or pyramid-scheme issue (Consumer Protection Act 2007, sch. 1). | /terms §3–§8, /faq |
| 3 | Financial-services characterisation | Confirm with counsel that the product, copy and "€1 trillion" framing cannot be construed as an investment, crowdfunding (Reg. (EU) 2020/1503) or a collective investment. Copy repeatedly states no return, no equity, no claim. | Hero disclosure, /join step 1 + mandatory acknowledgement, /terms §4 |
| 4 | Right of withdrawal | Validate the immediate-supply consent + acknowledgement wording (art. 16(m)) and that a durable-medium confirmation is sent. **Gap:** Stripe's receipt email is the only confirmation; counsel may require our own confirmation email containing the consent. Enable Stripe receipts at minimum. | /join step 7 checkbox 3; /refunds |
| 5 | VAT / OSS | Price is shown VAT-inclusive (€19.00 default). Determine VAT registration, rate and whether EU OSS applies for cross-border B2C digital supplies; configure Stripe Tax or invoice handling. | Settings → price; /terms §3 |
| 6 | Advertising claims | "Beat Elon" / use of a living person's name: trademark and passing-off/false-endorsement review in IE/EU/US. No likeness used; non-affiliation disclaimer on every page footer and OG image. | Footer, /challenge, OG card |
| 7 | GDPR | Review /privacy, lawful bases, the legitimate-interest assessment for hashed IP+UA referral fraud control, DPAs with Supabase/Vercel (Vercel transfer mechanism), and a ROPA entry. Decide DPO need (likely not required). | /privacy, /cookies |
| 8 | ePrivacy | Confirm no consent banner is needed: only strictly-necessary local/session storage and cookieless Vercel Analytics are used. | /cookies |
| 9 | Content moderation | Hosting liability (DSA notice-and-action, art. 16): /report form exists; confirm statement-of-reasons obligations for removals are met by our process. | /report, admin Reports tab, audit log |
| 10 | Age | Terms require 18+; decide whether an age confirmation checkbox is needed. | /terms, /privacy |
| 11 | Stripe | Stripe account approval for this business model (check Stripe's restricted-business list), statement descriptor, receipts on, Radar on. | Stripe dashboard |
| 12 | Refund policy | Confirm goodwill-refund wording and that refunds reconcile (charge.refunded webhook removes the entry). | /refunds |

## Configuration needed (no secret is in the repo)

Vercel → Project `trillioneuro` → Environment Variables (Production):

| Variable | Value |
|---|---|
| `SUPABASE_SECRET_KEY` | Supabase project `kxzywyflylkcqoidiqmo` → Settings → API keys → secret key (`sb_secret_…`) |
| `STRIPE_SECRET_KEY` | `sk_test_…` first, `sk_live_…` after approval |
| `STRIPE_WEBHOOK_SECRET` | from the webhook endpoint below |
| `TE_PAYMENTS_LIVE` | `true` only when launching |

Stripe → Developers → Webhooks → endpoint `https://www.trillioneuro.com/api/te-stripe-webhook`, events:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.

Admin access: create the founder's Supabase Auth user, then
`insert into public.te_admins (user_id, email) select id, email from auth.users where email = '<founder email>';`

Mail: `hello@`, `privacy@trillioneuro.com` are published — make sure they forward.

## Test-mode launch checklist

1. Set the four env vars with **test** keys and redeploy.
2. Dashboard: fill operator details, then Enable payments.
3. Buy an entry with card `4242 4242 4242 4242`; confirm entry Nº 000001 appears only after the webhook.
4. Refund it from Stripe; confirm it leaves /record.
5. **Reset before going live:** test entries consume numbers. Before switching to live keys run
   `delete from te_referral_clicks; delete from te_entries; delete from te_payment_events; delete from te_drafts; update te_counter set last = 0;` in the SQL editor
   so the first real participant is Nº 000001.
6. Swap to live keys, re-test with a real card, refund.
