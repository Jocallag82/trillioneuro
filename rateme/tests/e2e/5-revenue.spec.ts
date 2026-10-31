import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { db, createUser, login } from './helpers';

// Own network address so earlier suites' sign-ins don't count against the per-IP login limit.
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.77' } });

let bizId = '', reviewId = '';
const OWNER = 'free-owner@revtrades.ie';

test.beforeAll(async () => {
  const [b] = await db<{ id: string }[]>`
    insert into businesses (slug, name, category_id, county_id, status, source, published_at, description)
    select 'oconnor-e2e-electrical', 'O’Connor E2E Electrical', (select id from categories where slug = 'electricians'), co.id, 'published', 'admin', now(), 'Domestic electrician used for automated tests.'
    from counties co where co.slug = 'cork' on conflict (slug) do update set name = excluded.name returning id`;
  bizId = b.id;
  const uid = await createUser(OWNER, 'free-owner-pass-1', 'user', 'Free Owner');
  await db`insert into business_members (business_id, user_id, role, status, verified_at) values (${bizId}, ${uid}, 'owner', 'verified', now()) on conflict do nothing`;
  await db`insert into reviews (business_id, rating, body, experience_month, reviewer_name, reviewer_email, reviewer_email_hash, declaration_at, status, published_at)
    values (${bizId}, 2, 'Arrived late and the quote changed. Call me on 087 1234567.', date_trunc('month', now())::date, 'Siobhan', 'siobhan@example.ie', 'e2e-rev-h1', now(), 'published', now())
    on conflict do nothing`;
  [{ id: reviewId }] = await db<{ id: string }[]>`select id from reviews where business_id = ${bizId} and reviewer_email_hash = 'e2e-rev-h1'`;
  await db`insert into business_daily_stats (business_id, day, profile_views, qr_scans, review_starts) values (${bizId}, (now() at time zone 'Europe/Dublin')::date, 7, 2, 3)
           on conflict (business_id, day) do update set profile_views = 7, qr_scans = 2, review_starts = 3`;
});

test('free verified owner sees real 30-day numbers and a clear upgrade, without member tools', async ({ page }) => {
  await login(page, OWNER, 'free-owner-pass-1');
  await page.goto(`/dashboard/b/${bizId}?range=365`);
  await expect(page.getByRole('heading', { name: 'Customer feedback funnel' })).toBeVisible();
  await expect(page.getByText('These are your real numbers for the last 30 days.')).toBeVisible();
  await expect(page.getByRole('link', { name: '12 months' })).toHaveCount(0); // history is a member tool
  await expect(page.locator('dd', { hasText: /^7$/ }).first()).toBeVisible();
  await page.goto(`/dashboard/b/${bizId}/reviews`);
  await expect(page.getByText('Replying to reviews is a member feature')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft a reply' })).toHaveCount(0);
  // Website badge is free and shows the real figure
  await page.goto(`/dashboard/b/${bizId}/badge`);
  await expect(page.getByText('Rated 2.0 out of 5 from 1 review on RateMe.ie').first()).toBeAttached();
  const svg = await page.request.get('/badge/oconnor-e2e-electrical?style=dark');
  expect(svg.headers()['content-type']).toContain('image/svg+xml');
  expect(await svg.text()).toContain('1 review on RateMe.ie');
  expect((await page.request.get('/badge/does-not-exist')).status()).toBe(404);
});

test('AI reply draft: member-only, gated by admin switch, never auto-published, contact details redacted, metered', async ({ page }) => {
  await db`insert into subscriptions (business_id, stripe_subscription_id, status, amount_cents, current_period_end) values (${bizId}, 'sub_e2e_rev', 'active', 4999, now() + interval '300 days') on conflict do nothing`;
  await login(page, OWNER, 'free-owner-pass-1');
  await page.goto(`/dashboard/b/${bizId}/reviews`);
  await page.getByText('Respond publicly').click();
  await expect(page.getByRole('button', { name: 'Draft a reply' })).toHaveCount(0); // switch is off by default
  await db`update settings set value = value || '{"reply_drafts_enabled": true}'::jsonb where key = 'ai'`;
  await page.reload();
  await page.getByText('Respond publicly').click();
  await page.getByLabel('Tone').selectOption('empathetic');
  await page.getByRole('button', { name: 'Draft a reply' }).click();
  const box = page.getByLabel('Your response');
  await expect(box).toHaveValue(/Empathetic draft/);
  await expect(box).not.toHaveValue(/LEAK/);
  expect((await db`select 1 from review_responses where review_id = ${reviewId}`).length).toBe(0); // not published
  const [u] = await db`select input_tokens, output_tokens, cost_micro_usd, model from ai_usage where review_id = ${reviewId}`;
  expect(u).toMatchObject({ input_tokens: 420, output_tokens: 90, model: 'claude-haiku-5-5' });
  expect(u.cost_micro_usd).toBe(87); // 420 × 0.1 + 90 × 0.5
  await box.fill('Thank you, Siobhan. We’re sorry about the delay and would like to talk this through.');
  await page.getByRole('button', { name: 'Publish response' }).click();
  await expect(page.getByText('Response published.')).toBeVisible();
  // usage limit
  await db`update settings set value = value || '{"drafts_per_business_per_month": 1}'::jsonb where key = 'ai'`;
  await page.getByText('Edit response').click();
  await page.getByRole('button', { name: 'Draft a reply' }).click();
  await expect(page.getByText(/used this month’s 1 drafts/)).toBeVisible();
  await db`update settings set value = value || '{"reply_drafts_enabled": false, "drafts_per_business_per_month": 40}'::jsonb where key = 'ai'`;
  await db`delete from subscriptions where stripe_subscription_id = 'sub_e2e_rev'`;
});

test('outreach, partners, commercial and automation are admin-only', async ({ page }) => {
  await createUser('rev-mod@e2e.rateme.test', 'moderator-password-2', 'moderator', 'Rev Mod');
  await login(page, 'rev-mod@e2e.rateme.test', 'moderator-password-2');
  for (const p of ['/admin/outreach', '/admin/partners', '/admin/commercial', '/admin/notifications', `/admin/outreach/${bizId}`]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/dashboard\?denied=1/);
  }
});

test('founder outreach: claim link → claim is attributed to the campaign; partner link → sign-up carries the code', async ({ page, browser }) => {
  await createUser('rev-admin@e2e.rateme.test', 'admin-password-rev-1', 'admin', 'Rev Admin');
  await login(page, 'rev-admin@e2e.rateme.test', 'admin-password-rev-1');
  await page.goto('/admin/outreach/campaigns');
  await page.getByLabel('Name').fill('Cork trades E2E');
  await page.getByRole('button', { name: 'Create campaign' }).click();
  await expect(page.getByText('Campaign saved')).toBeVisible();
  const [target] = await db<{ id: string }[]>`insert into businesses (slug, name, category_id, county_id, status, source, published_at)
    select 'walsh-e2e-roofing', 'Walsh E2E Roofing', (select id from categories where slug = 'roofers'), co.id, 'published', 'admin', now() from counties co where co.slug = 'cork'
    on conflict (slug) do update set name = excluded.name returning id`;
  await page.goto(`/admin/outreach/${target.id}`);
  await page.getByLabel('Campaign').selectOption({ label: 'Cork trades E2E' });
  await page.getByLabel('Notes (private)').fill('Met at Mallow mart. Interested in the van sticker.');
  await page.getByRole('checkbox', { name: /I contacted them today/ }).check();
  await page.getByRole('button', { name: 'Save outreach record' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Create claim link/ }).click();
  await expect(page.getByText('Claim link ready')).toBeVisible();
  await page.getByRole('link', { name: 'Print letter' }).click();
  await expect(page.getByText('Walsh E2E Roofing has a listing on RateMe.ie')).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR code to claim this listing' })).toBeVisible();
  const [{ claim_token }] = await db`select claim_token from outreach_prospects where business_id = ${target.id}`;
  // notes never appear publicly
  await page.goto('/business/walsh-e2e-roofing');
  await expect(page.locator('body')).not.toContainText('Mallow mart');

  const owner = await browser.newPage({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.78' } });
  await createUser('walsh@walshroofing.ie', 'walsh-owner-pass-1', 'user', 'Pat Walsh');
  await login(owner, 'walsh@walshroofing.ie', 'walsh-owner-pass-1');
  await owner.goto(`/claim/${claim_token}`);
  await expect(owner).toHaveURL(/\/for-business\?claim=walsh-e2e-roofing/);
  await owner.goto(`/dashboard/claim?business=walsh-e2e-roofing&ct=${claim_token}`);
  await owner.getByRole('button', { name: 'Claim this business' }).click();
  await expect(owner).toHaveURL(/\/verify/);
  const [a] = await db`select a.source, c.name from business_attribution a join outreach_campaigns c on c.id = a.campaign_id where a.business_id = ${target.id}`;
  expect(a).toMatchObject({ source: 'campaign', name: 'Cork trades E2E' });
  await page.goto('/admin/outreach/campaigns');
  await expect(page.getByRole('row', { name: /Cork trades E2E/ })).toContainText('1');

  // Partner link carries the code through sign-up without cookies
  await page.goto('/admin/partners');
  await page.getByLabel('Code').fill('E2EACCT');
  await page.getByLabel('Name').fill('E2E Accountants');
  await page.getByLabel('Reward').selectOption('percent_first_payment');
  await page.getByLabel('Value').fill('20');
  await page.getByRole('button', { name: 'Save partner' }).click();
  await expect(page.getByText('Partner saved')).toBeVisible();
  const visitor = await browser.newPage({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.79' } });
  await visitor.goto('/p/e2eacct');
  await expect(visitor).toHaveURL(/\/for-business\?ref=E2EACCT/);
  await visitor.getByRole('link', { name: 'Create a free business account' }).click();
  await expect(visitor).toHaveURL(/ref=E2EACCT/);
  await visitor.getByLabel('Your name').fill('Referred Owner');
  await visitor.getByLabel('Email').fill('referred@newbiz.ie');
  await visitor.getByLabel('Password').fill('referred-pass-123');
  await visitor.getByRole('checkbox', { name: /I agree/ }).check();
  await visitor.waitForTimeout(2600);
  await visitor.getByRole('button', { name: 'Create account' }).click();
  await visitor.waitForURL(/verify-email/);
  const [u] = await db`select ref_code from users where email = 'referred@newbiz.ie'`;
  expect(u.ref_code).toBe('E2EACCT');
  await page.goto('/admin/commercial');
  await expect(page.getByText('Paying businesses')).toBeVisible();
});

test('daily job is idempotent and sends nothing while switches are off; unsubscribe works', async ({ request, page }) => {
  const before = (await db`select count(*)::int n from email_outbox`)[0].n;
  for (let i = 0; i < 2; i++) expect((await request.get('/api/cron/maintenance', { headers: { authorization: 'Bearer e2e-cron' } })).status()).toBe(200);
  const after = (await db`select count(*)::int n from email_outbox`)[0].n;
  expect(after).toBe(before);
  expect((await request.get('/api/cron/maintenance')).status()).toBe(401);
  await page.goto('/unsubscribe?e=someone@example.ie&t=wrong');
  await expect(page.getByText('This link is invalid or incomplete.')).toBeVisible();
  const t = crypto.createHmac('sha256', 'e2e-secret-value-0001').update('unsub:someone@example.ie').digest('hex').slice(0, 32);
  await page.goto(`/unsubscribe?e=someone@example.ie&t=${t}`);
  await page.getByRole('button', { name: 'Unsubscribe' }).click();
  await expect(page.getByText(/We won’t send this address/)).toBeVisible();
  expect((await db`select scope from email_suppressions where email = 'someone@example.ie'`)[0].scope).toBe('non_essential');
});
