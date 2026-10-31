# RateMe.ie — strategy, pricing and 90-day plan (Oct 2026)

## Verdict on the model
- **Keep €49.99/yr founding price.** It's under €1/week: an owner can say yes without asking anyone. Raising it
  before there's proof of traffic adds friction where you need volume. The real constraint is *distribution*, not price.
  Plan a €99/yr standard price once a county/vertical has demonstrable profile traffic; founding members keep €49.99.
- **Why a business pays now:** not "reviews" (Google is free) but the **kit + measurement**: printed QR material
  ready today, WhatsApp/email invite text, and a dashboard proving scans → published reviews. Sell the routine, not the platform.
- **Why a consumer uses RateMe over Google:** only in a niche where RateMe has *better* information. Google is
  unbeatable generally. Win on trades: transparent rules, owner replies, no pay-to-rank, and guides that answer "is this tradesperson legit?"
- **Beachhead: trades & home services in one or two counties (Cork + Dublin commuter belt).** High-ticket, trust-sensitive
  jobs, owners who live on word of mouth, physical touchpoints (van, invoice) for QR, and repeat local search intent.
  Repeat-customer businesses (salons, garages) are the second wave: they generate review volume fastest.
- **Cheapest acquisition channel:** direct outreach + the product itself. Every printed van sticker and invoice slip is
  an ad seen by other homeowners and other trades. Accountants/bookkeepers serving sole traders are the best partner channel.
- **Empty marketplace:** go deep, not wide. 300 claimed trades in one county beats 3,000 unclaimed nationwide.
  Never seed fake reviews; seed *listings* (public business info) and let owners pull their own customers in.
- **Moat:** trust rules that are actually enforced (rating-blind screening, reconfirmation disputes, no paid ranking),
  plus the physical QR footprint in the market. Both are slow to copy credibly.
- **Do NOT build yet:** AI review insights (no business has enough reviews; costs + GDPR processor work for zero value
  today — revisit at ~20 reviews/business, as a paid tier), comparison tool (needs data density), consumer accounts,
  referral programme (fraud risk; revisit with manual-approval "1 extra month per paying referral"), mobile apps, paid ads.

## 90-day plan
| Weeks | Action | Target |
|---|---|---|
| 1–2 | Operator legal details published (site shows a pre-launch warning until done); Stripe live keys; Resend domain; production migration 004 | Launch-ready |
| 1–4 | Founder sells door-to-door/phone to Cork trades: electricians, plumbers, builders, roofers. Demo = their printed kit on the spot | 100 conversations → 25 paying |
| 3–6 | 3 accountancy/bookkeeping partners send a "free listing + kit" note to sole-trader clients | 40 claims |
| 4–8 | Approach 2 Chambers / local business associations for a member mailout (no bulk marketing without their consent basis) | 30 claims |
| 6–12 | Publish 1 guide/week (consumer: "what to check before hiring a plumber/roofer in Ireland"; business: reply templates) | Index 15 pages |
| 8–12 | Expand to Dublin commuter counties once Cork has ≥5 categories with ≥3 listings (indexable threshold) | 100 paying total |

Unit economics check: 100 members × €49.99 ≈ €5k ARR. This is a validation milestone, not a business. The goal of the
90 days is **proof that kits produce published reviews** (the funnel now in the dashboard), which justifies the €99 price.

## Metrics to watch (all from recorded events)
Profile visits → QR scans → forms opened → submitted → confirmed → published (per business, dashboard);
claims started/completed (`business_members`), checkouts (`checkout_sessions`), paid (`subscriptions`).
Missing today: site-wide search/click analytics and acquisition-channel attribution — add `?ref=` capture on
`/register` stored on the user row (first-party, no cookie consent needed) before outreach starts.

## Open legal questions (need a qualified Irish solicitor)
- Defamation Act 2009 / Defamation (Amendment) Act 2024 position for hosting reviews; notice-and-action process under the EU DSA.
- Whether auto-removal after 14 days without reconfirmation is defensible both to reviewers and businesses.
- Omnibus Directive / Consumer Rights Act 2022 disclosure on how reviews are checked (the site discloses; confirm wording).
- Lawful basis and retention for reviewer emails and the new day-scoped visitor hashes (legitimate interest; 2-day retention).
