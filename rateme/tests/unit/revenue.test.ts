// Revenue engine: recipient rules, badge, attribution, notification idempotency/suppression, job leases.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { sql } from '@/lib/db';
import { classifyBusinessEmail, claimInviteEligible } from '@/lib/recipients';
import { renderBadge, badgeLabel } from '@/lib/badge';
import { effectiveStatus } from '@/lib/outreach';
import { rewardDue, attributeClaim } from '@/lib/attribution';
import { redactForModel } from '@/lib/ai';
import { onReviewPublished, processQueue, runRenewals, runJob, notifySettings } from '@/lib/notify';
import type { User } from '@/lib/auth';

let biz = '', reviewId = '', user: User;
const S = { claim_invite_enabled: true, digest_enabled: false, renewal_enabled: true, kit_nudge_enabled: false, max_per_run: 50 };

beforeAll(async () => {
  execSync('node scripts/migrate.mjs', { env: { ...process.env }, stdio: 'ignore' });
  await sql`truncate rateme.notifications, rateme.email_suppressions, rateme.business_attribution, rateme.partners, rateme.outreach_prospects, rateme.job_locks, rateme.job_runs cascade`;
  const [b] = await sql<{ id: string }[]>`insert into businesses (slug, name, category_id, county_id, status, source, public_email, website, website_domain, is_test_data)
    select 'rev-test-biz', 'Rev Test Plumbing', (select id from categories where slug = 'plumbers'), (select id from counties where slug = 'cork'), 'published', 'admin',
      'info@revtestplumbing.ie', 'https://revtestplumbing.ie', 'revtestplumbing.ie', true
    on conflict (slug) do update set public_email = excluded.public_email returning id`;
  biz = b.id;
  await sql`delete from business_members where business_id = ${biz}`;
  const [r] = await sql<{ id: string }[]>`insert into reviews (business_id, rating, experience_month, reviewer_name, reviewer_email, reviewer_email_hash, declaration_at, status, published_at)
    values (${biz}, 2, date_trunc('month', now())::date, 'Test', 'rev-reviewer@example.ie', ${'h' + Date.now()}, now(), 'published', now()) returning id`;
  reviewId = r.id;
  const [u] = await sql<User[]>`insert into users (email, password_hash, display_name, email_verified_at) values ('rev-owner@example.ie', 'x', 'Owner', now())
    on conflict (email) do update set ref_code = null, signup_claim_token = null returning *`;
  user = u;
});
afterAll(async () => { await sql.end(); });

describe('recipient classification (claim invites)', () => {
  it('only role mailboxes on the business domain are eligible', () => {
    expect(classifyBusinessEmail('info@murphy.ie', 'murphy.ie')).toBe('generic_mailbox');
    expect(classifyBusinessEmail('john@murphy.ie', 'murphy.ie')).toBe('business_domain');
    expect(classifyBusinessEmail('murphyplumbing@gmail.com', null)).toBe('unknown');
    expect(classifyBusinessEmail('info@other.ie', 'murphy.ie')).toBe('unknown');
    expect(claimInviteEligible('generic_mailbox')).toBe(true);
    expect(claimInviteEligible('business_domain')).toBe(false);
    expect(claimInviteEligible('unknown')).toBe(false);
  });
});

describe('badge', () => {
  it('shows real figures, and a neutral state with no reviews', () => {
    expect(renderBadge('light', 23, 4.84)).toContain('4.8');
    expect(badgeLabel(23, 4.84)).toBe('Rated 4.8 out of 5 from 23 reviews on RateMe.ie');
    const none = renderBadge('compact', 0, null);
    expect(none).toContain('Review us on RateMe.ie');
    expect(none).not.toContain('★');
    expect(renderBadge('light', 0, null)).not.toContain('reviews on');
  });
});

describe('outreach and partner maths', () => {
  it('real claim/payment state overrides manual status, except do-not-contact', () => {
    expect(effectiveStatus('contacted', false, false, true)).toBe('paid');
    expect(effectiveStatus('interested', false, true, false)).toBe('claimed_free');
    expect(effectiveStatus('do_not_contact', false, true, true)).toBe('do_not_contact');
    expect(effectiveStatus(null, false, false, false)).toBe('not_contacted');
  });
  it('rewards are computed from configuration', () => {
    expect(rewardDue({ type: 'percent_first_payment', value: 20 }, 4999, 1)).toMatchObject({ cents: 1000 });
    expect(rewardDue({ type: 'free_months', value: 2 }, 0, 3)).toMatchObject({ months: 6 });
  });
  it('blocks self-referral and never overwrites first-touch attribution', async () => {
    await sql`insert into partners (code, name, kind, contact_email) values ('SELFTEST', 'Self', 'accountant', 'rev-owner@example.ie')`;
    await sql`update users set ref_code = 'SELFTEST' where id = ${user.id}`;
    expect(await attributeClaim(biz, user)).toBe('self_referral_ignored');
    await sql`insert into partners (code, name, kind) values ('ACCTONE', 'Acct One', 'accountant')`;
    await sql`update users set ref_code = 'ACCTONE' where id = ${user.id}`;
    expect(await attributeClaim(biz, user)).toBe('partner');
    await sql`insert into outreach_campaigns (name) values ('Rev test camp') on conflict do nothing`;
    await sql`insert into outreach_prospects (business_id, claim_token, campaign_id) values (${biz}, 'tok_abcdefghijklmnop', (select id from outreach_campaigns where name = 'Rev test camp'))`;
    await attributeClaim(biz, user, 'tok_abcdefghijklmnop');
    const rows = await sql`select source from business_attribution where business_id = ${biz}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('partner');
  });
});

describe('AI privacy', () => {
  it('removes contact details before anything leaves the server', () => {
    const out = redactForModel('Call me on 087 123 4567 or mary@example.ie, I live at T12 AB34');
    expect(out).not.toMatch(/087|mary@|T12/);
  });
});

describe('claim invitations', () => {
  it('queues once per review, sends once, and respects the 90-day limit', async () => {
    await onReviewPublished(biz, reviewId);
    await onReviewPublished(biz, reviewId);
    expect((await sql`select 1 from notifications where kind = 'claim_invite' and business_id = ${biz}`).length).toBe(1);
    const r1 = await processQueue(S);
    expect(r1.outbox ?? r1.sent).toBe(1);
    expect((await processQueue(S)).outbox).toBeUndefined();
    const mail = await sql`select body_text from email_outbox where to_email = 'info@revtestplumbing.ie' and template = 'claim_invite'`;
    expect(mail).toHaveLength(1);
    expect(mail[0].body_text).toContain('/unsubscribe?e=');
    expect(mail[0].body_text).not.toContain('rev-reviewer@example.ie');
    await sql`insert into notifications (kind, dedupe_key, business_id) values ('claim_invite', 'claim_invite:second', ${biz})`;
    await processQueue(S);
    const [n] = await sql`select status, reason from notifications where dedupe_key = 'claim_invite:second'`;
    expect(n).toMatchObject({ status: 'suppressed', reason: 'invited in last 90 days' });
  });
  it('is held while disabled and suppressed for personal addresses or suppression list', async () => {
    await sql`update businesses set public_email = 'john@revtestplumbing.ie' where id = ${biz}`;
    await sql`insert into notifications (kind, dedupe_key, business_id) values ('claim_invite', 'claim_invite:personal', ${biz})`;
    await sql`delete from notifications where dedupe_key in ('claim_invite:second') or (kind = 'claim_invite' and status in ('sent','outbox'))`;
    await processQueue(S);
    expect((await sql`select reason from notifications where dedupe_key = 'claim_invite:personal'`)[0].reason).toMatch(/not eligible \(business_domain\)/);
    await sql`update businesses set public_email = 'info@revtestplumbing.ie' where id = ${biz}`;
    await sql`insert into notifications (kind, dedupe_key, business_id) values ('claim_invite', 'claim_invite:off', ${biz})`;
    await processQueue({ ...S, claim_invite_enabled: false });
    expect((await sql`select status from notifications where dedupe_key = 'claim_invite:off'`)[0].status).toBe('pending');
    await sql`insert into email_suppressions (email, reason) values ('info@revtestplumbing.ie', 'unsubscribed')`;
    await processQueue(S);
    expect((await sql`select reason from notifications where dedupe_key = 'claim_invite:off'`)[0].reason).toBe('on suppression list');
  });
  it('defaults to everything switched off', async () => {
    const s = await notifySettings();
    expect([s.claim_invite_enabled, s.digest_enabled, s.renewal_enabled, s.kit_nudge_enabled]).toEqual([false, false, false, false]);
  });
});

describe('renewal reminders and job leases', () => {
  it('sends one reminder per subscription period, never for cancelling subscriptions', async () => {
    await sql`insert into subscriptions (business_id, purchaser_id, stripe_subscription_id, status, amount_cents, current_period_end)
      values (${biz}, ${user.id}, 'sub_rev_1', 'active', 4999, now() + interval '20 days'),
             (${biz}, ${user.id}, 'sub_rev_2', 'active', 4999, now() + interval '5 days') on conflict do nothing`;
    await sql`update subscriptions set cancel_at_period_end = true where stripe_subscription_id = 'sub_rev_2'`;
    await runRenewals(); await runRenewals();
    const sent = await sql`select kind from notifications where kind like 'renewal_%' and business_id = ${biz}`;
    expect(sent.map((x) => x.kind)).toEqual(['renewal_30']);
  });
  it('a second concurrent run of the same job is skipped', async () => {
    let inner: unknown;
    const outer = await runJob('lease-test', async () => { inner = await runJob('lease-test', async () => 'ran'); return 'outer'; });
    expect(outer).toBe('outer');
    expect(inner).toEqual({ skipped: 'locked' });
    expect(await runJob('lease-test', async () => 'again')).toBe('again');
  });
});
