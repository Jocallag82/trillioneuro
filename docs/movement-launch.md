# Trillion Euro movement — launch dependencies and operations

Status: phase 1 (free registration, country communities, priority voting, invitations). **No payments exist anywhere in the product.**
Nothing here is legal advice; items marked ⚖ need a qualified Irish/EU professional before launch.

## Before the site goes live (in this order)

1. **Apply the migration** to Supabase project `kxzywyflylkcqoidiqmo` (SQL editor, or `supabase db push`):
   `supabase/migrations/20261121_mv_movement.sql`. It is additive and idempotent, and depends on helpers already in the project
   (`clean_text`, `rl_allow`, `te_countries`, `te_is_admin`). Then run the Supabase *Security* and *Performance* advisors.
2. **Supabase → Authentication → URL configuration**
   - Site URL: `https://www.trillioneuro.com`
   - Redirect URLs: `https://www.trillioneuro.com/**` (confirmation links land on `/dashboard`, reset links on `/join?mode=reset`).
3. **Supabase → Authentication → Providers → Email**: keep *Confirm email* **on** (the site counts, ranks and lets people vote only after
   confirmation — it is the main spam and fake-referral control); set *Minimum password length* to **10**.
4. **Spam protection**: enable *Attack Protection → CAPTCHA* (Cloudflare Turnstile or hCaptcha) in Supabase. The site's sign-up form currently
   sends no CAPTCHA token — add the widget to `assets/mv/join.js` (`gotrue_meta_security.captcha_token` in `MV.signUp`) in the same change.
5. **Email**: configure custom SMTP in Supabase (the default sender is rate-limited to a handful of emails per hour) and brand the
   *Confirm signup* / *Reset password* templates. Make sure `hello@` and `privacy@trillioneuro.com` forward to a monitored inbox.
6. **Admin**: add yourself — `insert into public.te_admins (user_id, email) select id, email from auth.users where email = '<you>';`
7. ⚖ **Controller identity**: the privacy notice and terms name “the operator of TrillionEuro.com”. Add the operator's legal name and
   postal address to `privacy.html`/`terms.html` (edit `site-src/pages/…`, `node site-src/build.mjs`). Also review: governing-law clause,
   16+ age gate, the “no financial return / not an investment” wording, referral wording (no incentives), DPAs with Supabase and Vercel,
   ROPA entry, and the legitimate-interest assessment for IP rate-limiting.
8. **Deploy** (Vercel project `trillioneuro`). No new environment variables are required. `MV_SITE_URL` is only used by local tests.
   Then submit `https://www.trillioneuro.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
9. Replace stock illustration with licensed photography if wanted: hero/priority art are bespoke SVG (`assets/mv/art.js`).

## Day-to-day operations (SQL editor)

```sql
-- review community ideas (they are invisible until approved)
select id, title, summary, created_at from mv_ideas where status = 'pending' order by created_at;
update public.mv_ideas set status = 'live' where id = <id>;   -- or 'rejected'

-- publish an announcement (appears on every dashboard)
insert into public.mv_announcements (title, body, published, published_at) values ('Title', 'Body', true, now());

-- start a new voting round (close the old one first)
update public.mv_rounds set status = 'closed', closes_at = now() where status = 'open';
insert into public.mv_rounds (slug, title, description) values ('round-2', 'Round 2', '…');

-- clear sign-ups that never confirmed (privacy notice promises this); schedule weekly
select public.mv_purge_unconfirmed(30);

-- rebuild every counter from source rows (should never be needed)
select public.mv_recount();

-- change the founding-contributor cut-off (default 10,000)
update public.mv_settings set value = '10000' where key = 'founding_limit';
```

Milestones (100 / 1,000 / 10,000 / 100,000 / 1,000,000 contributors; 10 / 100 / … per country) are written by the database at the moment the real
count crosses them. Do not insert them by hand.

## What is intentionally not built (yet)

- Marketing email: consent is recorded (`mv_profiles.marketing_consent` + timestamp) but nothing is sent. When it is, send only to opted-in rows.
- Other languages: the shell is locale-ready (`site-src/build.mjs`, `site-src/i18n`, `MV.t()`), page copy is English only.
- Per-country Open Graph *images*: link previews carry the country's name, rank and size in title/description; the image is the shared brand card.
  Contributors can download a per-person / per-country share graphic (drawn in the browser) from their dashboard and country pages.
- Cached counters live in single rows (`mv_counters`, `mv_country_counts`, `mv_ideas.vote_count`); at sustained hundreds of sign-ups per second,
  shard them or move to batched aggregation.
- The old Beat Elon tables (`te_*`) and the `founders*` / `quad_*` tables are untouched. `te_*` is empty and can be dropped when you are sure.

## Retired: Beat Elon paid record

The paid Founders' Record (Stripe checkout, webhook, admin dashboard, journal, entries) was removed from the site and `vercel.json`; its old
URLs return 308 to `/`, `/countries` or `/join`. Everything is in git history (commit `467dfd0` and earlier) if it ever needs reviving.
Stripe webhook endpoint `https://www.trillioneuro.com/api/te-stripe-webhook` (if you created one in Stripe) can be deleted.
